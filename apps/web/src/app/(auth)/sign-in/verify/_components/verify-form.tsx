'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Field, Input } from '@speclyy/design-system'
import { createBrowserSupabase } from '@speclyy/auth/browser'
import { decidePostAuthRedirect } from '@speclyy/auth/redirect'

type Status = 'idle' | 'verifying' | 'resending' | 'error'

interface VerifyFormProps {
  email: string
  /** Sanitized `next` (may be empty). */
  next: string
}

const RESEND_COOLDOWN_MS = 60_000
const CODE_LENGTH = 6

export function VerifyForm({ email, next }: VerifyFormProps) {
  const router = useRouter()
  const supabase = useMemo(() => createBrowserSupabase(), [])

  const [code, setCode] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  /** Epoch ms of the most recent resend; starts at page-arrival time so the
   *  first resend still respects Supabase's 1/60s rule. */
  const [lastSentAt, setLastSentAt] = useState<number>(() => Date.now())
  const [now, setNow] = useState<number>(() => Date.now())
  const inputRef = useRef<HTMLInputElement>(null)
  const autoSubmittedRef = useRef(false)

  // Tick `now` once a second while a cooldown is visible so the countdown
  // re-renders. Stop the interval when the cooldown has elapsed.
  useEffect(() => {
    const remaining = RESEND_COOLDOWN_MS - (Date.now() - lastSentAt)
    if (remaining <= 0) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [lastSentAt])

  const cooldownRemainingMs = Math.max(0, RESEND_COOLDOWN_MS - (now - lastSentAt))
  const cooldownSeconds = Math.ceil(cooldownRemainingMs / 1000)
  const canResend = cooldownRemainingMs === 0 && status !== 'resending'

  const verify = useCallback(
    async (token: string) => {
      setError(null)
      setStatus('verifying')

      // Supabase stores the OTP with a provider tag. For a `signInWithOtp`
      // magic-link email, existing users → 'magiclink', new users → 'signup'.
      // Try the most likely type first; if it fails with a "not found"-shaped
      // error, fall back to the other one before surfacing to the user.
      const attempt = async (type: 'email' | 'magiclink' | 'signup') =>
        supabase.auth.verifyOtp({ email, token, type })

      let result = await attempt('email')
      if (result.error) result = await attempt('magiclink')
      if (result.error) result = await attempt('signup')

      if (result.error) {
        const msg = result.error.message.toLowerCase()
        if (msg.includes('expired')) {
          setError('That code expired. Request a new one.')
        } else {
          setError("That code didn't work. Try again or resend.")
        }
        setStatus('error')
        setCode('')
        autoSubmittedRef.current = false
        inputRef.current?.focus()
        return
      }

      // Success — reuse the same post-auth redirect logic as /auth/callback so
      // magic-link vs. typed-code can never land different places.
      const target = await decidePostAuthRedirect(supabase, next)
      router.push(target)
      router.refresh()
    },
    [email, next, router, supabase],
  )

  // Auto-submit once we have a full 6-digit code.
  useEffect(() => {
    if (code.length === CODE_LENGTH && !autoSubmittedRef.current && status !== 'verifying') {
      autoSubmittedRef.current = true
      void verify(code)
    }
  }, [code, status, verify])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (code.length !== CODE_LENGTH) {
      setError('Enter all 6 digits.')
      return
    }
    await verify(code)
  }

  async function resend() {
    if (!canResend) return
    setError(null)
    setStatus('resending')
    // shouldCreateUser:false so re-sending can't silently re-create a deleted
    // account. The initial send from /sign-in uses true.
    const { error: resendError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`,
        shouldCreateUser: false,
      },
    })
    if (resendError) {
      const msg = resendError.message.toLowerCase().includes('rate')
        ? 'Too many attempts — wait 60s and try again.'
        : resendError.message
      setError(msg)
      setStatus('error')
      return
    }
    setLastSentAt(Date.now())
    setNow(Date.now())
    setStatus('idle')
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Verification code" htmlFor="code">
        <Input
          id="code"
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={CODE_LENGTH}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          placeholder="123456"
          autoComplete="one-time-code"
          autoFocus
          aria-describedby="code-help"
        />
      </Field>
      <p id="code-help" className="caption">
        Paste the 6-digit code — spaces and dashes are fine.
      </p>

      <Button
        type="submit"
        variant="primary"
        block
        disabled={status === 'verifying' || code.length !== CODE_LENGTH}
        aria-busy={status === 'verifying'}
      >
        {status === 'verifying' ? 'Verifying…' : 'Verify and continue'}
      </Button>

      <button
        type="button"
        className="caption underline decoration-ink-300 self-center disabled:no-underline disabled:text-ink-400"
        onClick={resend}
        disabled={!canResend}
      >
        {status === 'resending'
          ? 'Sending…'
          : canResend
            ? 'Resend code'
            : `Resend in ${cooldownSeconds}s`}
      </button>

      {error && (
        <p className="body-sm mt-2 text-red-600" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </form>
  )
}
