import { Button, ButtonLink, Logo, Pill } from '@speclyy/design-system'
import { Check } from '@speclyy/design-system/icons'

const features = [
  'Unlimited projects',
  'URL paste + manual entry',
  'Full Library access',
  'PDF + CSV export',
  'My Library (save & reuse)',
  'Studio branding on exports',
]

export default function BillingPage() {
  return (
    <main className="min-h-screen bg-app">
      <div className="max-w-[960px] mx-auto px-6 pt-10 pb-20">
        <div className="mb-10 flex items-center justify-between">
          <Logo href="/projects" />
          <ButtonLink href="/projects" variant="ghost" size="sm">Back to workspace</ButtonLink>
        </div>

        <p className="eyebrow mb-3">Billing</p>
        <h1 className="h1 mb-4">Your <span className="italic-serif">Studio</span> plan.</h1>
        <p className="body-lg mb-10 max-w-xl">Flat $39 per designer per month. Cancel anytime — your spec sheets stay exportable forever.</p>

        <div className="card card-subtle mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="eyebrow mb-2">Current plan</div>
              <div className="font-display text-40 leading-none">Studio</div>
              <div className="caption mt-2">Renews on Apr 28, 2026</div>
            </div>
            <Pill tone="complete">Active</Pill>
          </div>

          <ul className="flex flex-col gap-2.5 mb-8">
            {features.map(f => (
              <li key={f} className="flex gap-2.5 items-start body-sm">
                <Check size={16} className="text-accent mt-0.5" />
                {f}
              </li>
            ))}
          </ul>

          <div className="flex gap-3">
            <Button variant="ghost">Update payment method</Button>
            <Button variant="danger">Cancel subscription</Button>
          </div>
        </div>

        <div className="card">
          <div className="h4 mb-2">Invoices</div>
          <p className="body-sm">Downloadable invoices will appear here after your first successful charge.</p>
        </div>
      </div>
    </main>
  )
}
