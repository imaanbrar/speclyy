import { OnboardingShell } from '../../_components/shell'
import { PlanForm } from './_components/plan-form'

export default function OnboardingPlanPage() {
  return (
    <OnboardingShell
      step={4}
      eyebrow="How you'll use Speclyy"
      title={
        <>
          Start free. <span className="italic-serif">Upgrade</span> when you&rsquo;re ready to share.
        </>
      }
      description="Unlock all features with the Pro plan."
    >
      <PlanForm />
    </OnboardingShell>
  )
}
