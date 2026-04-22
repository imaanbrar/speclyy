import { ButtonLink, Field, Input, Logo } from '@speclyy/design-system'

export default function OnboardingStudioPage() {
  return (
    <main className="min-h-screen bg-app">
      <div className="max-w-md mx-auto px-6 pt-16 pb-20">
        <Logo href="/" />
        <p className="eyebrow mt-12">Step 2 of 3</p>
        <h1 className="h1 mt-3">Name your <span className="italic-serif">studio.</span></h1>
        <p className="body-lg mt-4">This appears in the header of every exported spec sheet. You can change it later.</p>

        <form className="mt-10 flex flex-col gap-5">
          <Field label="Studio name" optional helper="Freelancers often use their own name.">
            <Input name="studio" placeholder="e.g. Henley & Co." autoFocus />
          </Field>
          <div className="flex justify-between mt-2">
            <ButtonLink href="/onboarding/name" variant="ghost">Back</ButtonLink>
            <ButtonLink href="/onboarding/market" variant="primary">Continue</ButtonLink>
          </div>
        </form>
      </div>
    </main>
  )
}
