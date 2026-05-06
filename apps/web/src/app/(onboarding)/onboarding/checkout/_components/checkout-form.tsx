'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import type { Appearance, StripeElementsOptions } from '@stripe/stripe-js'
import { Button } from '@speclyy/design-system'
import { ArrowLeft, ArrowRight, Check } from '@speclyy/design-system/icons'

import { getStripeJs } from '@/lib/billing/stripe-browser'
import { startProCheckout } from '../actions'

type Interval = 'monthly' | 'annual'

/**
 * Plain-object plan summary, serializable across the Server → Client boundary.
 * The Server Component derives both monthly + annual from `plans.ts` and
 * hands them in — we don't re-query Stripe for display numbers on render.
 */
export interface PlanSummary {
  interval: Interval
  label: string
  /** Total billed per period, USD whole dollars. */
  amount: number
  /** Effective monthly cost (matches `amount` for monthly, divided for annual). */
  amountMonthlyEquivalent: number
  currency: 'USD'
  annualEquivalentLabel: string | null
}

interface Props {
  initialInterval: Interval
  plans: Record<Interval, PlanSummary>
}

/**
 * Stripe Elements `Appearance` config tuned to Speclyy's design tokens.
 *
 * Stripe's `<Elements>` renders inside an iframe — CSS custom properties
 * from the parent don't inherit. Hex values must be hardcoded here, kept in
 * sync with `packages/design-system/src/styles/tokens.css` by hand.
 */
const stripeAppearance: Appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#1A1814',
    colorBackground: '#FFFFFF',
    colorText: '#1A1814',
    colorDanger: '#B14A2C',
    fontFamily: '"Inter Tight", ui-sans-serif, system-ui, sans-serif',
    fontSizeBase: '15px',
    borderRadius: '6px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': {
      border: '1px solid rgba(26, 24, 20, 0.14)',
      boxShadow: 'none',
    },
    '.Input:focus': {
      border: '1px solid #1A1814',
      boxShadow: '0 0 0 3px rgba(26, 24, 20, 0.08)',
    },
    '.Label': {
      fontWeight: '500',
      color: 'rgba(26, 24, 20, 0.72)',
    },
  },
}

/**
 * `CheckoutForm` — embedded Elements wrapper in **deferred** mode.
 *
 * No `clientSecret` at mount time. We give Stripe the shape of the upcoming
 * payment (`mode: 'subscription'`, `amount`, `currency`) so it can render
 * `<PaymentElement>`; the actual subscription is created server-side from
 * `startProCheckout` only when the user clicks "Pay".
 *
 * Toggling the interval calls `elements.update({ amount })` so we don't
 * remount the iframe (which would clear half-typed card details).
 *
 * See:
 *   - docs/architecture/billing.md § "Checkout flow · Client"
 *   - docs/architecture/adr/0018-payment-surface.md — embedded Elements
 */
export function CheckoutForm({ initialInterval, plans }: Props) {
  const initialAmount = plans[initialInterval].amount * 100
  const initialCurrency = plans[initialInterval].currency.toLowerCase()

  // Memoized so the `<Elements>` provider isn't told its options object
  // changed identity on every parent render.
  const elementsOptions = useMemo<StripeElementsOptions>(
    () => ({
      mode: 'subscription',
      amount: initialAmount,
      currency: initialCurrency,
      appearance: stripeAppearance,
    }),
    [initialAmount, initialCurrency],
  )

  return (
    <Elements stripe={getStripeJs()} options={elementsOptions}>
      <CheckoutFormInner initialInterval={initialInterval} plans={plans} />
    </Elements>
  )
}

function CheckoutFormInner({ initialInterval, plans }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const [interval, setInterval] = useState<Interval>(initialInterval)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const plan = plans[interval]

  function handleIntervalChange(next: Interval) {
    if (next === interval || submitting) return
    setInterval(next)
    if (elements) {
      elements.update({ amount: plans[next].amount * 100 })
    }
    // Keep the URL in sync so a reload preserves the user's pick. `replace`
    // (not `push`) avoids stuffing the back button with toggle history.
    router.replace(`/onboarding/checkout?interval=${next}`, { scroll: false })
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    setError(null)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message ?? 'Please check your card details.')
      setSubmitting(false)
      return
    }

    // ----- 1. Server action — create the Stripe subscription -----
    // The action returns `{ ok, … }` on every reachable failure mode (Stripe
    // API error, already-subscribed, unauthenticated). The try/catch here
    // exists for **unreachable** failure modes — network drop between this
    // tab and the server, RSC payload parse error, or any other case where
    // the action's promise rejects instead of resolving with `{ ok: false }`.
    // Without this guard, `submitting` would stay `true` indefinitely and
    // the Pay button would lock at "Processing…".
    let actionResult: Awaited<ReturnType<typeof startProCheckout>>
    try {
      actionResult = await startProCheckout(interval)
    } catch (cause) {
      console.error('[checkout-form] startProCheckout threw', cause)
      setError('Network error. Please check your connection and try again.')
      setSubmitting(false)
      return
    }

    if (!actionResult.ok) {
      if (actionResult.code === 'already_subscribed') {
        window.location.href = '/projects'
        return
      }
      if (actionResult.code === 'unauthenticated') {
        window.location.href = '/sign-in'
        return
      }
      setError(actionResult.message)
      setSubmitting(false)
      return
    }

    // ----- 2. Stripe.js — confirm the payment intent -----
    // `confirmPayment` redirects via `return_url` ONLY on a successful charge
    // — on success this function never returns from the user's perspective.
    // Three outcomes do return to us here:
    //
    //   (a) Verbatim Stripe error surfaced as `confirmError` (declined card,
    //       failed 3DS challenge, etc.). Show the message inline.
    //   (b) **Abandoned 3DS** — user closes the auth modal without finishing.
    //       Stripe resolves with `error: undefined` (no redirect, no error).
    //       Previously this branch left `submitting=true` forever.
    //   (c) Thrown rejection — extremely rare, but possible if Stripe.js's
    //       chunk fails to load mid-flight or the iframe goes away. Treat as
    //       a network error.
    //
    // All three must reset `submitting` so the form is retryable.
    let confirmErrorMessage: string | null = null
    try {
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret: actionResult.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/billing/success`,
        },
      })
      if (confirmError) {
        confirmErrorMessage = confirmError.message ?? 'Payment failed. Please try again.'
      }
    } catch (cause) {
      console.error('[checkout-form] confirmPayment threw', cause)
      confirmErrorMessage = 'Network error. Please try again.'
    }

    if (confirmErrorMessage) {
      setError(confirmErrorMessage)
    }
    // Unconditional reset — covers the abandoned-3DS path (case b above).
    setSubmitting(false)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <IntervalPicker
        value={interval}
        onChange={handleIntervalChange}
        plans={plans}
        disabled={submitting}
      />

      <div className="card">
        <PaymentElement />
      </div>

      {error && (
        <p
          className="body-sm"
          role="alert"
          style={{ color: 'var(--status-missing, #B14A2C)' }}
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-between mt-2">
        <a
          href="/onboarding/plan"
          className="btn btn-text"
          aria-label="Back to plan selection"
        >
          <ArrowLeft size={16} /> Back
        </a>
        <Button
          type="submit"
          variant="dark"
          disabled={!stripe || submitting}
          aria-busy={submitting}
        >
          {submitting ? 'Processing…' : `Pay $${plan.amount} ${plan.currency}`}
          <ArrowRight size={16} />
        </Button>
      </div>

      <p className="caption" style={{ color: 'var(--fg-3)' }}>
        Secured by Stripe. We never see your card details. Cancel any time
        from Settings.
      </p>
    </form>
  )
}

function IntervalPicker({
  value,
  onChange,
  plans,
  disabled,
}: {
  value: Interval
  onChange: (next: Interval) => void
  plans: Record<Interval, PlanSummary>
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label="Billing interval" className="flex flex-col gap-3">
      <IntervalOption
        active={value === 'annual'}
        disabled={disabled}
        onSelect={() => onChange('annual')}
        title="Annual"
        priceLine={`$${plans.annual.amountMonthlyEquivalent}/mo`}
        sublabel={`Billed $${plans.annual.amount} ${plans.annual.currency} once a year`}
        badges={[
          { label: 'Recommended', tone: 'primary' },
          { label: 'Save 30%', tone: 'discount' },
        ]}
      />
      <IntervalOption
        active={value === 'monthly'}
        disabled={disabled}
        onSelect={() => onChange('monthly')}
        title="Monthly"
        priceLine={`$${plans.monthly.amount}/mo`}
        sublabel={`Billed $${plans.monthly.amount} ${plans.monthly.currency} every month`}
      />
    </div>
  )
}

function IntervalOption({
  active,
  disabled,
  onSelect,
  title,
  priceLine,
  sublabel,
  badges,
}: {
  active: boolean
  disabled?: boolean
  onSelect: () => void
  title: string
  priceLine: string
  sublabel: string
  badges?: Array<{ label: string; tone: 'primary' | 'discount' }>
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      disabled={disabled}
      className="card cursor-pointer text-left w-full"
      style={{
        borderColor: active ? 'var(--ink-900)' : 'var(--border-1)',
        background: 'var(--bg-surface)',
        boxShadow: active ? 'var(--shadow-sm)' : 'none',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div className="flex items-start gap-4">
        <span
          className="grid place-items-center shrink-0"
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: '1.5px solid currentColor',
            opacity: active ? 1 : 0.5,
            marginTop: 2,
          }}
          aria-hidden
        >
          {active && <Check size={14} />}
        </span>
        <div className="flex-1 flex items-baseline justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="h4">{title}</span>
              {badges?.map((b) => (
                <span
                  key={b.label}
                  className="pill"
                  style={
                    b.tone === 'primary'
                      ? { background: 'var(--ink-900)', color: 'var(--paper-50)' }
                      : { background: 'var(--terracotta-50)', color: 'var(--terracotta-700)' }
                  }
                >
                  {b.label}
                </span>
              ))}
            </div>
            <p className="caption mt-1" style={{ color: 'var(--fg-3)' }}>
              {sublabel}
            </p>
          </div>
          <div className="font-display text-32 leading-none whitespace-nowrap">
            {priceLine}
          </div>
        </div>
      </div>
    </button>
  )
}
