import { ButtonLink, Field, Input, Logo } from '@speclyy/design-system'

export default function OnboardingNamePage() {
  return (
    <main className="min-h-screen bg-app">
      <div className="max-w-md mx-auto px-6 pt-16 pb-20">
        <Logo href="/" />
        <p className="eyebrow mt-12">Step 1 of 3</p>
        <h1 className="h1 mt-3">What should we <span className="italic-serif">call you?</span></h1>
        <p className="body-lg mt-4">Your name appears on exported spec sheets, next to your studio.</p>

        <form className="mt-10 flex flex-col gap-5">
          <Field label="Full name" helper="Use the name clients know you by.">
            <Input name="name" placeholder="e.g. Renée Cortez" autoFocus />
          </Field>
          <div className="flex justify-end mt-2">
            <ButtonLink href="/onboarding/studio" variant="primary">Continue</ButtonLink>
          </div>
        </form>
      </div>
    </main>
  )
}
