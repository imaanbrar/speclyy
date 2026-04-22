import { ButtonLink, Logo } from '@speclyy/design-system'

export default function Home() {
  return (
    <main className="min-h-screen grid place-items-center bg-app px-6 text-center">
      <div>
        <Logo />
        <h1 className="display-2 mt-10">
          The product OS for <span className="italic-serif text-accent">interior designers.</span>
        </h1>
        <p className="body-lg mt-6 max-w-lg mx-auto">
          Capture products, organize by room, and export spec sheets your builder will actually read.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <ButtonLink href="/sign-in" variant="primary" size="lg">Start free trial</ButtonLink>
          <ButtonLink href="/sign-in" variant="ghost" size="lg">Sign in</ButtonLink>
        </div>
      </div>
    </main>
  )
}
