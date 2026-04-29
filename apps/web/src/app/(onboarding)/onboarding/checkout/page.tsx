import { OnboardingShell } from '../../_components/shell'

/**
 * Stub for Pro checkout. The billing group (TASK-BILL-04) replaces this with
 * an embedded Stripe Elements page. Until then, picking Pro on /onboarding/plan
 * lands here so the route doesn't 404 — the user can step Back to switch to
 * Free without losing the rest of their onboarding state.
 */
export default function OnboardingCheckoutPage() {
  return (
    <OnboardingShell
      step={4}
      eyebrow="Checkout"
      title={
        <>
          Pro checkout <span className="italic-serif">coming soon.</span>
        </>
      }
      description="We're wiring up the payment form. In the meantime, head back and start on Free — you can upgrade any time from Settings."
    >
      <div className="flex items-center gap-3">
        <a href="/onboarding/plan" className="btn btn-ghost">← Back to plans</a>
      </div>
    </OnboardingShell>
  )
}
