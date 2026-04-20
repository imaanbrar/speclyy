# Auth — Architecture

How authentication works in Speclyy, end-to-end. For the *why* behind these choices, see [ADR-0005](adr/0005-auth-provider.md), [ADR-0006](adr/0006-session-strategy.md), and [ADR-0007](adr/0007-auth-data-model.md).

---

## Overview

```mermaid
flowchart TB
  subgraph Browser
    UI[Client Components]
    Cookie[(httpOnly session cookies)]
  end

  subgraph Vercel["Vercel / Next.js"]
    MW[middleware.ts]
    RSC[Server Components]
    SA[Server Actions]
    Cb[/auth/callback route]
  end

  subgraph Supabase
    Auth[Supabase Auth / GoTrue]
    DB[(Postgres<br/>auth.users<br/>public.profiles<br/>public.subscriptions)]
  end

  Google[Google OAuth]

  UI -->|"Sign in with Google"| Auth
  Auth --> Google
  Google --> Cb
  Cb -->|sets cookies| Cookie
  Cookie -->|every request| MW
  MW -->|getUser + refresh| Auth
  MW -->|profile + subscription| DB
  MW --> RSC
  UI --> SA
  SA --> DB
  RSC --> DB
```

## Components

| Component | Role |
|---|---|
| **Supabase Auth (GoTrue)** | Runs Google OAuth, issues JWT access + refresh tokens, manages `auth.users`. |
| **`@supabase/ssr`** | Next.js client library. Three factories: `createBrowserClient`, `createServerClient` (RSC / Server Actions), and a middleware variant that rewrites cookies. |
| **`middleware.ts`** | Runs on every non-static request. Refreshes session and enforces route gates. |
| **`public.profiles`** | App-side user record, 1:1 with `auth.users`. Created via DB trigger on signup. |
| **`public.subscriptions`** | Trial + Stripe state per user. Written by the Stripe webhook handler using the service-role key. |

---

## Sign-in flow

1. User clicks **Continue with Google** on `/sign-in`.
2. Client Component calls:
   ```ts
   supabase.auth.signInWithOAuth({
     provider: 'google',
     options: { redirectTo: `${origin}/auth/callback` },
   })
   ```
3. Browser redirects to Google consent screen.
4. Google redirects back to `/auth/callback?code=...`.
5. `/auth/callback/route.ts` calls `supabase.auth.exchangeCodeForSession(code)`. Supabase sets cookies on the response:
   - `sb-<project-ref>-auth-token` — contains access + refresh tokens. Flags: `httpOnly`, `Secure`, `SameSite=Lax`.
6. Postgres `AFTER INSERT` trigger on `auth.users` creates the blank `public.profiles` row (first-time sign-in only).
7. Callback redirects:
   - New user (no `onboarding_completed_at`) → `/onboarding/name`
   - Existing onboarded user → `/projects`

## Session lifecycle

- **Access token** — JWT, ~1 hour lifetime. Signed by Supabase. Middleware verifies signature locally (no round-trip).
- **Refresh token** — longer-lived (weeks), single-use. Exchanged for a new access + refresh token pair when the access token is near expiry.
- **Silent refresh** — `supabase.auth.getUser()` in middleware triggers refresh if needed. New cookies returned as `Set-Cookie` headers on the response. User never sees a logout.
- **Sign-out** — `supabase.auth.signOut()` revokes the refresh token server-side and clears both cookies.

---

## Middleware gate chain

See [ADR-0007](adr/0007-auth-data-model.md) for rationale.

```ts
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = ['/', '/sign-in', '/auth/callback', '/privacy', '/terms']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // 1. Refresh session (may rewrite cookies on response)
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'))

  // 2. Unauthenticated gate
  if (!user) {
    if (isPublic) return response
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  // 3. Onboarding gate
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_onboarded')
    .eq('id', user.id)
    .single()

  const isOnboardingPath = path.startsWith('/onboarding')
  const isSignOut = path === '/sign-out'

  if (!profile?.is_onboarded && !isOnboardingPath && !isSignOut) {
    return NextResponse.redirect(new URL('/onboarding/name', request.url))
  }
  if (profile?.is_onboarded && isOnboardingPath) {
    return NextResponse.redirect(new URL('/projects', request.url))
  }

  // 4. Trial / subscription gate
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, trial_ends_at')
    .eq('user_id', user.id)
    .single()

  const trialExpired =
    sub?.trial_ends_at != null && sub.trial_ends_at < new Date().toISOString()
  const lapsed = ['canceled', 'past_due', 'incomplete_expired'].includes(sub?.status ?? '')
  const needsBilling =
    (trialExpired && sub?.status !== 'active') || lapsed

  const isBillingPath = path.startsWith('/billing')
  if (needsBilling && !isBillingPath && !isSignOut) {
    return NextResponse.redirect(new URL('/billing', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg)).*)'],
}
```

---

## Data model

```sql
-- auth.users is Supabase-managed. Never modify.

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  studio_name text,
  market text CHECK (market IN ('los_angeles','new_york','dallas','calgary')),
  onboarding_completed_at timestamptz,
  is_onboarded boolean GENERATED ALWAYS AS (onboarding_completed_at IS NOT NULL) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_is_onboarded_idx ON public.profiles (is_onboarded);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN (
    'trialing','active','past_due','canceled','incomplete','incomplete_expired'
  )),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  promo_code_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_id_idx ON public.subscriptions (user_id);

-- Trigger: create profile on auth.users insert
CREATE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (new.id);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## Row-Level Security

All application tables enable RLS. Baseline policies on the auth-adjacent tables:

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: self read" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles: self update" ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions: self read" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- No user-facing INSERT/UPDATE policies on subscriptions.
-- Stripe webhooks write via service_role key, which bypasses RLS.
```

`auth.uid()` resolves to the user ID encoded in the JWT carried by the request's cookie. The service-role key (used only in Stripe webhooks and background jobs) bypasses RLS entirely and must never appear in client-reachable code.

Downstream tables (`projects`, `groups`, `items`, etc.) follow the same pattern, typically filtering by `owner_id = auth.uid()` or via a join through a user-owned parent.

---

## Sign-out flow

1. User clicks **Sign out**.
2. Server Action calls `supabase.auth.signOut()`.
3. Supabase revokes the refresh token server-side.
4. Session cookies cleared on the response.
5. Redirect to `/sign-in`.

---

## Edge cases

| Case | Behavior |
|---|---|
| **OAuth callback error** (`error` param) | `/auth/callback` redirects to `/sign-in?error=<code>` with a friendly message. |
| **Expired refresh token** (user idle for weeks) | `getUser()` returns null; middleware treats as unauthenticated → `/sign-in`. |
| **User deleted in Supabase dashboard** | Existing cookies fail verification; middleware clears them and redirects. |
| **Profile row missing** (should not occur due to trigger) | Onboarding route defensively upserts the row before proceeding. |
| **Concurrent onboarding tabs** | Last write wins on `onboarding_completed_at`. No real risk. |
| **Cookies blocked by browser** | Sign-in fails with a user-facing error prompting the user to enable cookies for the domain. |

---

## Testing approach

- **Unit** — Middleware logic tested with mocked Supabase responses across the state matrix (auth × onboarded × subscription-status).
- **Integration (Playwright)** — Full sign-in flow with a test Google account, complete onboarding, verify cookie flags, verify RLS by running queries as user X and asserting no user-Y rows are returned.
- **Schema contract** — Assert the `handle_new_user` trigger creates a `profiles` row on `auth.users` insert.
- **Webhook contract** — Simulate Stripe subscription lifecycle events and verify `subscriptions` rows update correctly; assert user is never redirected incorrectly after a `trialing` → `active` transition.

---

## References

- [ADR-0005 — Auth provider: Supabase Auth](adr/0005-auth-provider.md)
- [ADR-0006 — Session strategy: cookie SSR via `@supabase/ssr`](adr/0006-session-strategy.md)
- [ADR-0007 — Auth data model and middleware gates](adr/0007-auth-data-model.md)
- [Supabase Auth with Next.js App Router](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [`screen-inventory.md`](../screen-inventory.md) §1–2 (auth + onboarding)
- [`user-flows.md`](../user-flows.md) "Supporting Flow — First-time setup"
