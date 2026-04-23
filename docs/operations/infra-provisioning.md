# Infrastructure Provisioning

End-to-end runbook for standing up Speclyy's infrastructure from scratch. Follow top-to-bottom when building a new environment (separate prod tenant, disaster rebuild, second-engineer onboarding). Update here when the infra changes — this doc is the source of truth for "how the live setup got that way."

**Scope**

- GitHub → Vercel projects
- Custom-domain DNS via GoDaddy
- Supabase shared-auth project (URL config, providers, sessions, API keys)
- Google Cloud OAuth client
- Env-var wiring (Vercel + `.env.local`)

**Status (as of this provisioning pass)**

- ✅ `speclyy-auth` Supabase project is **provisioned and live** — handles all authentication for every `*.speclyy.com` app
- 🟡 `speclyy-web` per-app Supabase project is **not yet provisioned** — separate task, see "Per-app database (future)" below
- ✅ Vercel projects (`speclyy-marketing`, `speclyy-web`) created; domains `speclyy.com` and `app.speclyy.com` live via GoDaddy DNS

**Out of scope** (separate docs)

- Stripe — see [billing.md](../architecture/billing.md)
- Fly.io scraper — see [scraper/README.md](../architecture/scraper/README.md)

---

## Prerequisites

- GitHub access to `imaanbrar/speclyy`
- Vercel account/team (note your **team slug** — appears in `vercel.com/<slug>` and in every preview URL)
- Google Cloud account
- Supabase account
- GoDaddy account holding `speclyy.com`

---

## 1. Vercel projects

Two separate Vercel projects — one per app — so each app rebuilds independently on commits that touch it (Vercel's monorepo detection traverses the workspace package graph).

| Project | Root dir | Framework | Domain |
|---|---|---|---|
| `speclyy-marketing` | `apps/marketing` | Astro | `speclyy.com` (apex) |
| `speclyy-web` | `apps/web` | Next.js | `app.speclyy.com` |

For each:

1. Vercel dashboard → **Add New → Project**
2. Import `imaanbrar/speclyy`
3. Set **Root Directory** to `apps/marketing` or `apps/web`
4. Framework auto-detects; default Build / Install commands are fine
5. Skip env-var entry — we fill them in after Supabase (§5)

Importing the same repo twice is fine; Vercel just warns.

**Branch → environment mapping** (automatic, no config needed):

| Branch pattern | Vercel scope |
|---|---|
| `main` | Production |
| any other branch | Preview |
| (`vercel dev` locally) | Development — we don't use this scope |

Override the production branch in Project → Settings → Git if needed.

---

## 2. Domain + DNS (GoDaddy)

Apex `speclyy.com` → `speclyy-marketing`. Subdomain `app.speclyy.com` → `speclyy-web`.

### 2a. Tell Vercel about each domain

In each project: **Settings → Domains → Add**.

- `speclyy-marketing`: add `speclyy.com` (and optionally `www.speclyy.com` if you want www→apex redirect — Vercel offers it as a one-click)
- `speclyy-web`: add `app.speclyy.com`

Vercel shows the DNS records it needs to verify ownership + route traffic. Keep that page open.

### 2b. Add records in GoDaddy

GoDaddy dashboard → **My Products → DNS** for `speclyy.com`.

**Apex (`speclyy-marketing`):**

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `76.76.21.21` | 600 |
| CNAME | `www` | `cname.vercel-dns.com` | 600 |

**Subdomain (`speclyy-web`):**

| Type | Name | Value | TTL |
|---|---|---|---|
| CNAME | `app` | `cname.vercel-dns.com` | 600 |

**GoDaddy quirks**

- Apex A record uses `@` as the host
- CNAME `Name` field — enter just `app` or `www`, GoDaddy auto-appends `.speclyy.com`
- Default TTL is 1 hour. Use 600s during setup so mistakes are cheap to fix; bump back to 3600+ after launch for less query chatter
- GoDaddy may pre-populate a `Parked` CNAME on `www` — delete it before adding the Vercel one, or the change won't save

### 2c. Verify

DNS propagation: minutes to a couple hours. Track with:

```bash
dig +short app.speclyy.com
dig +short speclyy.com
```

Or use [whatsmydns.net](https://www.whatsmydns.net) to see global propagation.

Once Vercel sees the records, it auto-provisions Let's Encrypt SSL (green checkmark on the Domains page). After SSL is live:

- `https://speclyy.com` → marketing site
- `https://app.speclyy.com` → web app

---

## 3. Google Cloud OAuth

Used for the "Continue with Google" sign-in path. **Supabase brokers the OAuth flow** — Google only ever redirects to Supabase, never directly to our app. This is the key design point that makes preview-URL handling tractable (§4a).

1. Google Cloud Console → **New Project** "Speclyy"
2. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: `Speclyy`, support email: yours
   - Privacy policy URL + Terms of Service URL: production URLs (placeholders are fine during dev, but Google requires real ones for verification before unlimited users)
   - **Authorized domains:** `speclyy.com`
   - **Scopes: `email` + `profile` only.** Do not add others — Google verification gets stricter for non-trivial scopes
3. **Credentials → Create Credentials → OAuth Client ID**
   - Application type: **Web application**
   - Name: `Supabase Speclyy`
   - **Authorized redirect URIs:** `https://<your-project-ref>.supabase.co/auth/v1/callback` — you'll fill this in after creating the Supabase project in §4. Come back here and paste it. **No other URIs go here** — not localhost, not the prod URL.
4. Copy the **Client ID** and **Client Secret** (you'll paste both into Supabase in §4b)

> **Why Google's redirect-URI list has only ONE entry:** the OAuth flow goes browser → Google → **Supabase** callback → our app. Google's `redirect_uri` is always Supabase's GoTrue endpoint; our app callbacks are managed in Supabase's Redirect URLs allowlist (§4a), which supports glob wildcards. Google does not.

---

## 4. Supabase project

This is the **shared auth project** per [ADR-0019](../architecture/adr/0019-multi-app-architecture.md). App-specific databases are separate projects.

1. Supabase dashboard → **New project**
   - Name: `speclyy-auth`
   - Region: closest to majority of users
   - Save the DB password somewhere safe (needed for direct DB access)
2. Wait ~2 min for provisioning

### 4a. URL Configuration

**Auth → URL Configuration:**

- **Site URL:** `https://app.speclyy.com`
- **Redirect URLs** (allowlist; supports glob wildcards):
  - `http://localhost:3000/auth/callback`
  - `https://app.speclyy.com/auth/callback`
  - `https://speclyy-web-*-<your-vercel-team-slug>.vercel.app/auth/callback` ← preview deploys

> **Never use bare `https://*.vercel.app/auth/callback`.** That lets any deployment on the internet be a valid redirect target — phishing vector. Always scope wildcards to your Vercel team slug.

### 4b. Google provider

**Auth → Providers → Google:**

- Enable
- Paste **Client ID** and **Client Secret** from §3 step 4
- Copy the "Callback URL (for OAuth)" Supabase shows (`https://<ref>.supabase.co/auth/v1/callback`) — go back to the GCP OAuth client (§3 step 3) and paste it as the only Authorized redirect URI

### 4c. Email provider

**Auth → Providers → Email:**

- Enable
- **Confirm email: ON** (enumeration resistance — even though we use OTP, this prevents leaking which emails are registered)
- Use the default OTP template (covers both sign-up and sign-in)

### 4d. Sessions

**Auth → Sessions:**

- **Inactivity timeout: 90 days** (per [ADR-0006](../architecture/adr/0006-session-strategy.md))

> **Cookie domain is not a Supabase dashboard setting** (any longer). Cookie attributes are controlled by `@supabase/ssr` in our app code via `cookieOptions: { domain: '.speclyy.com' }` (env-gated to production). See [packages/auth/src/server.ts](../../packages/auth/src/server.ts) and [packages/auth/src/middleware.ts](../../packages/auth/src/middleware.ts). The leading dot is mandatory for the cookie to be shared across `*.speclyy.com` subdomains.

### 4e. API keys

Use the **new key system** (publishable + secret), not the legacy anon/service_role JWTs.

**Settings → API → API Keys:**

| Key | Format | Where it's used | Public? |
|---|---|---|---|
| **Publishable key** | `sb_publishable_…` | Browser + server clients (Supabase client lib) | Yes — safe in browser bundle, RLS does the protection |
| **Secret key** | `sb_secret_…` | Server-only (Stripe webhook, ops scripts) | **NO — bypasses RLS** |

If you only see the legacy section (`anon` + `service_role` JWTs starting `eyJ…`), look for the "API Keys (new)" tab or a **Create secret key** button. Supabase exposes both formats during the migration window.

> **Why new keys, not legacy:** new secret keys are individually revocable. Legacy `service_role` can only be rotated by regenerating the whole JWT secret, which also invalidates `anon` and forces every existing session to re-auth. Cheap insurance against the day a secret leaks.

**Also copy:** Settings → API → **Project URL** (`https://<ref>.supabase.co`).

---

## 5. Env-var wiring

Three Supabase values, two destinations (Vercel + local).

| Env var | Source | Bundle? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL | client + server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Settings → API → publishable key | client + server |
| `SUPABASE_SECRET_KEY` | Settings → API → secret key (click reveal) | **server only** |

The `NEXT_PUBLIC_` prefix is a Next.js convention: at build time, Next.js inlines `NEXT_PUBLIC_*` into the browser bundle and refuses to expose anything else. `SUPABASE_SECRET_KEY` has no prefix and is therefore physically excluded from client code (resolves to `undefined` if a Client Component tries to read it).

### 5a. Vercel

`speclyy-web` project → **Settings → Environment Variables**. For each var:

- Add the value
- Check **Production** + **Preview** scopes
- Leave **Development** unchecked (that's for `vercel dev`; we use `pnpm dev` + `.env.local`)

`speclyy-marketing` does **not** need Supabase env vars — the marketing site doesn't authenticate.

### 5b. Local

Copy [apps/web/.env.local.example](../../apps/web/.env.local.example) → `apps/web/.env.local` and paste the same three values. `.env.local` is gitignored.

---

### 5c. Per-app database (future)

The Supabase project provisioned above (`speclyy-auth`) only owns auth-adjacent tables (`profiles`, `organizations`, `organization_members`, `subscriptions`) — accessed via the Supabase client + RLS, no Drizzle needed.

App-specific tables (Speclyy projects, documents, etc.) live in a **separate Supabase project**, `speclyy-web`, that has not been provisioned yet. When it is:

- Create a second Supabase project named `speclyy-web` (same region as `speclyy-auth` to minimise cross-project latency)
- Settings → Database → Connection string:
  - "Direct connection" (port 5432) → `DATABASE_URL` — for migrations / scripts
  - "Connection pooling" → mode "Transaction" (port 6543) → `DATABASE_URL_POOLED` — for app runtime (Vercel serverless)
- Add both to Vercel `speclyy-web` env (Production + Preview) and to local `.env.local`

Until that project exists, leave `DATABASE_URL` and `DATABASE_URL_POOLED` blank in [apps/web/.env.local.example](../../apps/web/.env.local.example) — nothing in the auth group reads them. The provisioning task for the per-app DB is tracked separately and will append its own section here when it lands.

---

## 6. Verification

Walk through TASK-AUTH-01's acceptance criteria:

1. **Google OAuth** reaches consent screen end-to-end in local dev
2. **Email OTP** delivers a 6-digit code + magic link within 60s
3. **`.env.local` placeholders** exist in the example file
4. **Inactivity timeout** is 90 days in the dashboard

Plus production-side smoke tests:

5. `https://app.speclyy.com` loads the web app
6. `https://speclyy.com` loads the marketing site
7. After sign-in on `app.speclyy.com`, the `sb-<ref>-auth-token` cookie has `HttpOnly`, `Secure`, `SameSite=Lax`. (`Domain=.speclyy.com` becomes set once the `@supabase/ssr` `cookieOptions` are wired in TASK-AUTH-03.)

---

## Operational notes

- **Secret-key compromise:** see [operations.md § "Service-role key compromise"](../architecture/operations.md). For new `sb_secret_…` keys: revoke individually in Settings → API → API Keys. For legacy `service_role` JWTs: rotate the whole JWT secret in Settings → API → JWT Settings (also invalidates `anon`).
- **Adding a new preview URL pattern** (e.g. a forked PR from a contributor with a different team slug): add their pattern to Supabase Redirect URLs. Keep the list closed — don't leave a temporary pattern in prod.
- **Rotating the JWT secret** invalidates every issued JWT — all sessions log out. Plan the rotation window accordingly once we have users.

---

## References

- [ADR-0005 — Auth provider: Supabase Auth](../architecture/adr/0005-auth-provider.md)
- [ADR-0006 — Session strategy: cookie SSR](../architecture/adr/0006-session-strategy.md)
- [ADR-0019 — Multi-app architecture](../architecture/adr/0019-multi-app-architecture.md)
- [auth.md](../architecture/auth.md) — runtime architecture
- [deployments.md](../architecture/deployments.md) — env-var inventory, branch model
- [TASK-AUTH-01](../implementation-tasks/auth/TASK-AUTH-01-provision-supabase.md) — acceptance criteria this doc satisfies
