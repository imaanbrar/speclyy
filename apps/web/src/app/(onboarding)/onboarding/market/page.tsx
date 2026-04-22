import { ButtonLink, Logo } from '@speclyy/design-system'

const markets = [
  { id: 'la',      label: 'Los Angeles' },
  { id: 'ny',      label: 'New York' },
  { id: 'dallas',  label: 'Dallas' },
  { id: 'calgary', label: 'Calgary' },
]

export default function OnboardingMarketPage() {
  return (
    <main className="min-h-screen bg-app">
      <div className="max-w-md mx-auto px-6 pt-16 pb-20">
        <Logo href="/" />
        <p className="eyebrow mt-12">Step 3 of 3</p>
        <h1 className="h1 mt-3">Which market <span className="italic-serif">do you work in?</span></h1>
        <p className="body-lg mt-4">We tune the Library to the vendors and showrooms in your area.</p>

        <div className="mt-10 grid grid-cols-2 gap-3">
          {markets.map(m => (
            <button
              key={m.id}
              className="card card-hover text-left h4"
              style={{ padding: '20px 20px' }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex justify-between mt-10">
          <ButtonLink href="/onboarding/studio" variant="ghost">Back</ButtonLink>
          <ButtonLink href="/projects" variant="primary">Finish setup</ButtonLink>
        </div>
      </div>
    </main>
  )
}
