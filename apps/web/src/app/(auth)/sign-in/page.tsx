import { redirect } from 'next/navigation'
import { Logo } from '@speclyy/design-system'
import { sanitizeNext, decidePostAuthRedirect } from '@speclyy/auth/redirect'
import { createServerSupabase } from '@speclyy/auth/server'
import { SignInForm } from './_components/sign-in-form'

type SearchParams = Promise<{ error?: string; next?: string }>

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "You cancelled the Google sign-in. Try again when you're ready.",
  oauth_failed: "Something went wrong talking to Google. Try again, or use email.",
  otp_expired: 'That code expired. Request a new one below.',
  unknown: "We couldn't finish signing you in. Try again.",
}

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const next = sanitizeNext(params.next ?? null)
  const errorCode = params.error
  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.unknown)
    : null

  // Already signed in? Bounce straight to the post-auth destination instead
  // of re-rendering the sign-in form. Same helper the callback + verify-form
  // use so magic-link / typed-code / return-visit all land the same place.
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const target = await decidePostAuthRedirect(supabase, next)
    redirect(target)
  }

  return (
    <main className="min-h-screen grid place-items-center bg-app px-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-10">
          <Logo href="/" />
        </div>

        <div className="card p-10">
          <h1 className="h2 mb-2">Welcome back.</h1>
          <p className="body-sm mb-8">Sign in to pick up where you left off.</p>

          <SignInForm next={next} initialError={errorMessage} />
        </div>

        <p className="caption text-center mt-6">
          By continuing you agree to the{' '}
          <a href="/terms" className="underline decoration-ink-300">
            Terms
          </a>{' '}
          and{' '}
          <a href="/privacy" className="underline decoration-ink-300">
            Privacy Policy
          </a>
          .
        </p>
        <p className="caption text-center mt-2 text-ink-400">
          We&rsquo;ll keep you signed in on this browser.
        </p>
      </div>
    </main>
  )
}
