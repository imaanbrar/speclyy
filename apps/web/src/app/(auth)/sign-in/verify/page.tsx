import { redirect } from 'next/navigation'
import { Logo } from '@speclyy/design-system'
import { sanitizeNext } from '@speclyy/auth/redirect'
import { VerifyForm } from './_components/verify-form'

type SearchParams = Promise<{ email?: string; next?: string }>

export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const email = params.email?.trim()
  const next = sanitizeNext(params.next ?? null)

  // No email in the URL → nothing to verify. Bounce back to the email input.
  if (!email) {
    redirect('/sign-in')
  }

  return (
    <main className="min-h-screen grid place-items-center bg-app px-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-10">
          <Logo href="/" />
        </div>

        <div className="card p-10">
          <h1 className="h2 mb-2">Check your inbox.</h1>
          <p className="body-sm mb-8">
            Enter the 6-digit code we sent to <strong>{email}</strong>. You can also click the
            magic link in the email to finish signing in.
          </p>

          <VerifyForm email={email} next={next} />
        </div>

        <p className="caption text-center mt-6">
          Wrong email?{' '}
          <a href="/sign-in" className="underline decoration-ink-300">
            Go back
          </a>
          .
        </p>
      </div>
    </main>
  )
}
