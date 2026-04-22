import { ButtonLink, Logo } from '@speclyy/design-system'

export default function SignInPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-app px-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-10">
          <Logo href="/" />
        </div>

        <div className="card p-10">
          <h1 className="h2 mb-2">Welcome back.</h1>
          <p className="body-sm mb-8">Sign in to pick up where you left off.</p>

          <ButtonLink href="/auth/callback" variant="dark" block>
            Continue with Google
          </ButtonLink>

          <p className="caption mt-8 text-center">
            New to Speclyy?{' '}
            <a href="/sign-in" className="text-accent font-medium">Start a 7-day trial</a>
          </p>
        </div>

        <p className="caption text-center mt-6">
          By continuing you agree to the <a href="/terms" className="underline decoration-ink-300">Terms</a> and <a href="/privacy" className="underline decoration-ink-300">Privacy Policy</a>.
        </p>
      </div>
    </main>
  )
}
