'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Field, Input } from '@speclyy/design-system'
import { createBrowserSupabase } from '@speclyy/auth/browser'

type Status = 'idle' | 'sending' | 'error'

interface SignInFormProps {
  /** Sanitized `next` from the URL (may be empty). */
  next: string
  /** Pre-mapped error message from `?error=`, if any. */
  initialError: string | null
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function SignInForm({ next, initialError }: SignInFormProps) {
  const router = useRouter()
  const supabase = useMemo(() => createBrowserSupabase(), [])

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(initialError)

  const nextParam = next ? `?next=${encodeURIComponent(next)}` : ''

  async function signInWithGoogle() {
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback${nextParam}` },
    })
    if (oauthError) {
      setError(oauthError.message)
      setStatus('error')
    }
  }

  async function sendLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!EMAIL_REGEX.test(email)) {
      setError('Enter a valid email address.')
      setStatus('error')
      return
    }

    setStatus('sending')
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback${nextParam}`,
        shouldCreateUser: true,
      },
    })

    if (otpError) {
      const message = otpError.message.toLowerCase().includes('rate')
        ? 'Too many attempts — wait 60s and try again.'
        : otpError.message
      setError(message)
      setStatus('error')
      return
    }

    // Preserve both email + next across the hop to the verify screen.
    const verifyQuery = new URLSearchParams({ email })
    if (next) verifyQuery.set('next', next)
    router.push(`/sign-in/verify?${verifyQuery.toString()}`)
  }

  return (
    <>
      <Button variant="dark" block onClick={signInWithGoogle} aria-busy={status === 'sending'}>
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3 caption">
        <span className="flex-1 border-t border-ink-200" />
        <span>or</span>
        <span className="flex-1 border-t border-ink-200" />
      </div>

      <form onSubmit={sendLink} className="flex flex-col gap-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@studio.com"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
          />
        </Field>
        <Button
          type="submit"
          variant="primary"
          block
          disabled={status === 'sending'}
          aria-busy={status === 'sending'}
        >
          {status === 'sending' ? 'Sending…' : 'Send link'}
        </Button>
        <p className="caption">
          We&rsquo;ll email a magic link and a 6-digit code — no password.
        </p>
      </form>

      {error && (
        <p className="body-sm mt-4 text-red-600" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
