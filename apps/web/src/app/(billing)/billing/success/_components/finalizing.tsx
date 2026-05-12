'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ButtonLink } from '@speclyy/design-system'
import { ArrowRight, Loader } from '@speclyy/design-system/icons'

/**
 * `Finalizing` — interim Client Component shown when `/billing/success`
 * renders before the activating webhook lands. Polls `/api/billing/status`
 * every second for up to 15 seconds and triggers a Server Component refresh
 * once `status === 'active'` so the server-side page swaps in the receipt.
 *
 * Why a polling loop and not realtime? At MVP volume the webhook lands well
 * inside 5s — Stripe → our edge is sub-second on average. Realtime
 * subscriptions over WebSockets would mean a Supabase channel, RLS replication
 * config, and a much larger surface to debug. A 15-poll loop is dumb but
 * obviously correct.
 *
 * State machine:
 *
 *     polling --(active)--> success (Server Component takes over via refresh)
 *           \-(15s elapsed)-> timeout
 *
 * On unmount we abort any in-flight `fetch` and clear timers — the user
 * navigating away mid-poll mustn't leak a request that races with their next
 * page.
 *
 * The fallback ("still processing") deliberately routes back to the plan
 * picker rather than `/projects`. Onboarding-stamping happens server-side in
 * the active branch only; we don't want a user with a paid-but-unactive
 * subscription bouncing into an empty workspace.
 *
 * See:
 *   - docs/implementation-tasks/billing-subscription/TASK-BILL-06-pro-success-screen.md
 *     § "Acceptance criteria · Webhook in flight / Polling timeout"
 */

const POLL_INTERVAL_MS = 1_000
const POLL_TIMEOUT_MS = 15_000

type State = 'polling' | 'timeout'

interface StatusResponse {
  status: string | null
}

export function Finalizing() {
  const router = useRouter()
  const [state, setState] = useState<State>('polling')

  // Refs so the polling loop and unmount cleanup share the same handles
  // without making them React state (state changes would re-trigger the
  // effect; we want a single long-lived loop per mount).
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    const startedAt = Date.now()

    async function tick() {
      if (cancelled) return

      // Hard cap regardless of how many ticks have run. Stop short of issuing
      // a final fetch we'd just ignore.
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setState('timeout')
        return
      }

      const ctl = new AbortController()
      abortRef.current = ctl
      try {
        const res = await fetch('/api/billing/status', {
          signal: ctl.signal,
          // Belt-and-braces over the route's `Cache-Control: no-store`. The
          // browser fetch cache won't satisfy `no-store` anyway, but `no-cache`
          // here makes the intent obvious at the call site.
          cache: 'no-store',
        })
        if (!res.ok) {
          // 401/503 etc — schedule another tick. The endpoint may be
          // transiently flaky; the timeout cap is the real escape hatch.
          schedule()
          return
        }
        const json = (await res.json()) as StatusResponse
        if (cancelled) return
        if (json.status === 'active') {
          // Server Component will pick up the new row and switch to the
          // receipt branch. We stay mounted just long enough for the
          // refresh to commit.
          router.refresh()
          return
        }
        schedule()
      } catch (err) {
        if (cancelled) return
        // AbortError on unmount is expected; ignore.
        if (err instanceof DOMException && err.name === 'AbortError') return
        // Any other error — log + keep polling. The timeout will catch us.
        console.warn('[billing/success] poll error', err)
        schedule()
      }
    }

    function schedule() {
      if (cancelled) return
      timerRef.current = setTimeout(tick, POLL_INTERVAL_MS)
    }

    // Kick off the first poll on next tick so the parent has rendered before
    // we issue any network — keeps DevTools' Network panel ordering sane.
    timerRef.current = setTimeout(tick, 0)

    return () => {
      cancelled = true
      abortRef.current?.abort()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [router])

  if (state === 'timeout') {
    return <TimeoutPanel />
  }
  return <PollingPanel />
}

function PollingPanel() {
  return (
    <div className="text-center py-16">
      <div
        className="grid place-items-center mx-auto mb-6"
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-1)',
          color: 'var(--ink-900)',
        }}
        aria-hidden
      >
        <span style={{ display: 'inline-flex', animation: 'spin 1.1s linear infinite' }}>
          <Loader size={24} />
        </span>
      </div>
      <p className="eyebrow mb-3">Almost there</p>
      <h1 className="h1">
        Finalizing your <span className="italic-serif">subscription.</span>
      </h1>
      <p className="body-lg mt-4 max-w-md mx-auto" role="status" aria-live="polite">
        Hang tight — this usually takes a second or two while we confirm the
        payment with our processor.
      </p>

      {/* `prefers-reduced-motion` users see a static glyph rather than a
          spinning one; the status text already communicates the state. */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation: spin"] { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

function TimeoutPanel() {
  return (
    <div className="text-center py-16">
      <p className="eyebrow mb-3">Still processing</p>
      <h1 className="h1">
        We&rsquo;ll <span className="italic-serif">email you</span> when it
        lands.
      </h1>
      <p className="body-lg mt-4 max-w-md mx-auto">
        Your payment went through, but our records haven&rsquo;t caught up
        yet. You&rsquo;ll get a confirmation email shortly — no further action
        needed.
      </p>

      <div className="flex items-center justify-center gap-3 mt-10">
        <ButtonLink href="/onboarding/plan" variant="ghost">
          Back to plan
        </ButtonLink>
        <ButtonLink href="/projects" variant="dark">
          Continue to workspace <ArrowRight size={16} />
        </ButtonLink>
      </div>
    </div>
  )
}
