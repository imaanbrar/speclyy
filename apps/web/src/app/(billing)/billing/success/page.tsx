import { redirect } from 'next/navigation'
import { ButtonLink, Logo, Pill } from '@speclyy/design-system'
import { ArrowRight, Check } from '@speclyy/design-system/icons'
import { createServerSupabase } from '@speclyy/auth/server'

import { stripe, type Stripe } from '@/lib/billing/stripe'

import { Finalizing } from './_components/finalizing'

interface PageProps {
  searchParams: Promise<{ payment_intent?: string; redirect_status?: string }>
}

/**
 * `/billing/success` — Stripe's `return_url` lands here. The page is the
 * first surface that confirms a Pro subscription is real, sets the onboarding
 * timestamp for users coming from Step 4, and routes them into the workspace.
 *
 * Three render paths:
 *
 *   1. **Active on arrival.** Webhook + invoice landed before the user did
 *      (the typical case in production — Stripe pushes the event in a few
 *      hundred ms). We render the receipt and a single CTA into `/projects`.
 *
 *   2. **Webhook in flight, sub row exists.** `subscriptions.status` is
 *      `incomplete` — `customer.subscription.created` landed but
 *      `invoice.payment_succeeded` hasn't. Hand off to the `<Finalizing>`
 *      polling client.
 *
 *   3. **Webhook in flight, no sub row yet.** Both webhook events still
 *      pending. Verify the PaymentIntent server-side via Stripe to confirm
 *      this isn't a tampered URL, then hand off to `<Finalizing>`.
 *
 * **Onboarding stamping.** Onboarding is stamped any time we have proof the
 * user paid — either an existing `subscriptions` row OR a verified
 * `payment_intent` query param. This is what unsticks the "webhook never
 * lands" case (`<Finalizing>` timeout): without an early stamp, clicking
 * "Continue to workspace" from the timeout panel would bounce the user to
 * `/onboarding/name` because middleware checks `is_onboarded`. Pro
 * entitlement remains gated by `subscriptions.status` regardless — the
 * stamp only signals "user is past the onboarding wall".
 *
 * **Tamper resistance.** We never trust `redirect_status` alone; the
 * `payment_intent` is round-tripped through Stripe's API to confirm the
 * charge actually succeeded. A user visiting
 * `/billing/success?redirect_status=succeeded` without a real PI gets
 * bounced like any other no-row visitor.
 *
 * **Onboarding completion guard.** The `WHERE onboarding_completed_at IS NULL`
 * clause is required: without it, repeat visits would stomp the original
 * timestamp.
 *
 * See:
 *   - docs/architecture/billing.md § "Success / cancel return"
 *   - docs/implementation-tasks/billing-subscription/TASK-BILL-06-pro-success-screen.md
 */
export default async function ProSuccessPage({ searchParams }: PageProps) {
  // ----- 1. Auth (middleware also enforces this; defensive) -----
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  // ----- 2. Read both the subscription and the profile in parallel -----
  // We need `onboarding_completed_at` for both branches: the active branch
  // stamps it (if NULL); the no-row branch uses it to decide where to bounce.
  const [subRes, profileRes, params] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('status, current_period_end, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle(),
    searchParams,
  ])

  const sub = subRes.data
  const onboardingCompleted = Boolean(profileRes.data?.onboarding_completed_at)

  // ----- 3. No subscription row → maybe webhook hasn't fired yet -----
  // Don't trust `redirect_status` alone (URL-tamperable). Verify the PI
  // server-side: if Stripe says it succeeded, this is a real payment that
  // simply beat the webhook. Stamp onboarding eagerly so the user isn't
  // stuck in the `<Finalizing>` timeout → /projects → middleware bounce
  // loop, and hand off to the poller.
  if (!sub) {
    const verified =
      params.redirect_status === 'succeeded' && params.payment_intent
        ? await verifyPaymentIntent(params.payment_intent)
        : false

    if (verified) {
      if (!onboardingCompleted) await stampOnboarding(supabase, user.id)
      return (
        <SuccessShell>
          <Finalizing />
        </SuccessShell>
      )
    }

    // Either no PI on the URL, or Stripe says the PI didn't succeed. The
    // user shouldn't be on this page yet.
    redirect(onboardingCompleted ? '/projects' : '/onboarding/plan')
  }

  // ----- 4. Sub row exists → stamp onboarding regardless of status -----
  // Reaching here means `confirmPayment` redirected (Stripe only redirects
  // on success) AND the `subscription.created` webhook has landed. Even if
  // `invoice.payment_succeeded` is still pending and we render
  // `<Finalizing>` below, the user has demonstrably paid — they should be
  // past the onboarding wall. Pro entitlement is gated by `sub.status`,
  // not this stamp.
  if (!onboardingCompleted) {
    await stampOnboarding(supabase, user.id)
  }

  // ----- 5. Not yet active → hand off to the polling client -----
  // `incomplete` is the typical state immediately after `confirmPayment`
  // succeeds — the webhook flips it to `active` within a second or two.
  if (sub.status !== 'active') {
    return (
      <SuccessShell>
        <Finalizing />
      </SuccessShell>
    )
  }

  // ----- 6. Receipt -----
  // One Stripe round-trip to canonicalize amount + interval. We could derive
  // the interval from `current_period_end - now` but that's fragile (proration,
  // backdated periods, etc.). The price object is authoritative.
  const receipt = sub.stripe_subscription_id
    ? await loadReceipt(sub.stripe_subscription_id, sub.current_period_end)
    : fallbackReceipt(sub.current_period_end)

  return (
    <SuccessShell>
      <Receipt receipt={receipt} />
    </SuccessShell>
  )
}

// ----------------------------------------------------------------------------
// Receipt rendering
// ----------------------------------------------------------------------------

interface ReceiptData {
  /** "Pro · Annual" / "Pro · Monthly" */
  planLabel: string
  /** "$348.00 USD" — formatted for the line-item row. */
  amountLabel: string
  /** "Renews May 1, 2027" — `null` if we couldn't parse a renewal date. */
  renewalLabel: string | null
}

async function loadReceipt(
  stripeSubscriptionId: string,
  fallbackPeriodEnd: string | null,
): Promise<ReceiptData> {
  try {
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ['items.data.price'],
    })
    const item = sub.items.data[0]
    const price = item?.price as Stripe.Price | undefined
    const interval = price?.recurring?.interval // 'day' | 'week' | 'month' | 'year'
    const intervalLabel =
      interval === 'year' ? 'Annual' : interval === 'month' ? 'Monthly' : 'Pro'

    const unitAmount = price?.unit_amount ?? null // cents
    const currency = (price?.currency ?? 'usd').toUpperCase()
    const amountLabel =
      unitAmount === null ? '—' : formatMoney(unitAmount / 100, currency)

    const renewalEpoch = resolvePeriodEndEpoch(sub)
    const renewalDate = renewalEpoch
      ? new Date(renewalEpoch * 1000)
      : fallbackPeriodEnd
        ? new Date(fallbackPeriodEnd)
        : null

    return {
      planLabel: `Pro · ${intervalLabel}`,
      amountLabel,
      renewalLabel: renewalDate ? `Renews ${formatDate(renewalDate)}` : null,
    }
  } catch (cause) {
    // The receipt is decorative; the user is Pro regardless. Fall back to
    // what we have on file rather than tanking the page.
    console.error('[billing/success] receipt fetch failed', {
      stripeSubscriptionId,
      error: cause instanceof Error ? cause.message : String(cause),
    })
    return fallbackReceipt(fallbackPeriodEnd)
  }
}

/**
 * Resolve `current_period_end` from a Stripe Subscription with a fallback
 * chain. API version 2026-04-22.dahlia surfaces this field in two places:
 *
 *   1. `subscription.current_period_end` (compat shim — kept for now)
 *   2. `subscription.items.data[0].current_period_end` (canonical)
 *
 * If Stripe drops the compat shim in a future API version, the
 * subscription-level read will return `undefined` and we'd silently lose the
 * renewal date. Read both with subscription-level winning when present, then
 * fall through to the line item, then to `null`.
 *
 * Mirrored in `apps/web/src/app/api/webhooks/stripe/route.ts:periodEndDate`.
 */
function resolvePeriodEndEpoch(sub: Stripe.Subscription): number | null {
  const subLevel = (sub as Stripe.Subscription & { current_period_end?: number })
    .current_period_end
  if (typeof subLevel === 'number') return subLevel

  const item = sub.items?.data?.[0] as
    | (Stripe.SubscriptionItem & { current_period_end?: number })
    | undefined
  const itemLevel = item?.current_period_end
  if (typeof itemLevel === 'number') return itemLevel

  return null
}

function fallbackReceipt(periodEnd: string | null): ReceiptData {
  const date = periodEnd ? new Date(periodEnd) : null
  return {
    planLabel: 'Pro',
    amountLabel: '—',
    renewalLabel: date ? `Renews ${formatDate(date)}` : null,
  }
}

function formatMoney(amount: number, currency: string): string {
  // `Intl.NumberFormat` for stable cross-locale rendering. We pass the
  // currency code explicitly so $ doesn't get ambiguous between USD/CAD.
  return `${new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(amount)} ${currency}`
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

// ----------------------------------------------------------------------------
// Onboarding stamping + PaymentIntent verification
// ----------------------------------------------------------------------------

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabase>>

/**
 * Mark `profiles.onboarding_completed_at = now()` if it's still NULL. The
 * `.is('onboarding_completed_at', null)` clause makes a refresh-on-this-page
 * idempotent (a second visit doesn't bump the timestamp).
 *
 * Errors are non-blocking and logged: the user's Pro entitlement is gated by
 * `subscriptions.status` regardless, so onboarding state syncs on their next
 * request even if this write fails transiently.
 */
async function stampOnboarding(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', userId)
    .is('onboarding_completed_at', null)

  if (error) {
    console.error('[billing/success] onboarding stamp failed', {
      userId,
      error: error.message,
    })
  }
}

/**
 * Round-trip the `payment_intent` query param through Stripe's API to confirm
 * it represents a successful charge. We never trust `redirect_status=succeeded`
 * alone: the URL is end-user-controlled, so a sufficiently bored user could
 * paste `/billing/success?redirect_status=succeeded` into the address bar and
 * — without verification — get past the onboarding wall without paying.
 *
 * Returns `false` on any non-success state (`requires_payment_method`,
 * `processing`, `canceled`, etc.) and on any exception. Callers fall back to
 * the redirect-to-plan-picker branch.
 */
async function verifyPaymentIntent(paymentIntentId: string): Promise<boolean> {
  // Defensive shape check: Stripe IDs are `pi_<base62>`. Reject anything that
  // doesn't match before we burn an API call.
  if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) return false

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    return pi.status === 'succeeded'
  } catch (cause) {
    // No such PI, or Stripe rate-limited / down. Treat as unverified — the
    // user just gets bounced to the plan picker; if the payment was real,
    // they'll see Pro on next sign-in once the webhook lands.
    console.error('[billing/success] PI verification failed', {
      paymentIntentId,
      error: cause instanceof Error ? cause.message : String(cause),
    })
    return false
  }
}

// ----------------------------------------------------------------------------
// Visual chrome — kept inline because this page has its own layout (no shared
// "billing" shell yet; TASK-BILL-07 lands the customer portal page that will
// share this).
// ----------------------------------------------------------------------------

function SuccessShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-app">
      <header className="flex items-center justify-between px-6 md:px-10 py-6">
        <Logo href="/projects" />
        <span className="eyebrow">Pro · Active</span>
      </header>

      <main className="flex-1 grid place-items-center px-6 pb-16">
        <div className="w-full max-w-xl">{children}</div>
      </main>

      <footer className="px-6 md:px-10 py-6 flex items-center justify-between caption">
        <span>© Speclyy 2026</span>
        <div className="flex items-center gap-4">
          <a href="/privacy" className="link-quiet">Privacy</a>
          <span aria-hidden>·</span>
          <a href="/terms" className="link-quiet">Terms</a>
        </div>
      </footer>
    </div>
  )
}

function Receipt({ receipt }: { receipt: ReceiptData }) {
  return (
    <>
      <div className="text-center pt-4 pb-10">
        <div
          className="grid place-items-center mx-auto mb-6"
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-1)',
            color: 'var(--ink-900)',
          }}
          aria-hidden
        >
          <Check size={24} />
        </div>
        <p className="eyebrow mb-3">You&rsquo;re in</p>
        <h1 className="h1">
          Welcome to <span className="italic-serif">Pro.</span>
        </h1>
        <p className="body-lg mt-4">
          Unlimited PDF spec sheets and shareable client links are now live on
          your account.
        </p>
      </div>

      <div className="card card-subtle">
        <div className="flex items-center justify-between mb-5">
          <span className="eyebrow">Receipt</span>
          <Pill tone="complete">Active</Pill>
        </div>

        <div
          className="flex items-center justify-between py-3"
          style={{ borderBottom: '1px solid var(--border-1)' }}
        >
          <span className="body-sm" style={{ color: 'var(--fg-2)' }}>Plan</span>
          <span className="body-sm" style={{ color: 'var(--fg-1)', fontWeight: 600 }}>
            {receipt.planLabel}
          </span>
        </div>

        <div
          className="flex items-center justify-between py-3"
          style={{ borderBottom: '1px solid var(--border-1)' }}
        >
          <span className="body-sm" style={{ color: 'var(--fg-2)' }}>Amount</span>
          <span className="body-sm" style={{ color: 'var(--fg-1)', fontWeight: 600 }}>
            {receipt.amountLabel}
          </span>
        </div>

        {receipt.renewalLabel && (
          <div className="flex items-center justify-between py-3">
            <span className="body-sm" style={{ color: 'var(--fg-2)' }}>Next charge</span>
            <span className="body-sm" style={{ color: 'var(--fg-1)' }}>
              {receipt.renewalLabel}
            </span>
          </div>
        )}

        <p className="caption mt-3" style={{ color: 'var(--fg-3)' }}>
          A copy of your invoice is on its way to your inbox. Manage billing
          any time from Settings.
        </p>
      </div>

      <div className="flex items-center justify-end mt-8">
        <ButtonLink href="/projects" variant="dark">
          Open your workspace <ArrowRight size={16} />
        </ButtonLink>
      </div>
    </>
  )
}
