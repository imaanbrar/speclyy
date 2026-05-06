'use client'

import { useActionState, useState, type KeyboardEvent } from 'react'
import { Button } from '@speclyy/design-system'
import { ArrowLeft, ArrowRight, Check } from '@speclyy/design-system/icons'
import { continueOnboarding, type PlanActionState } from '../actions'

type Plan = 'free' | 'pro'

export function PlanForm() {
  const [plan, setPlan] = useState<Plan>('free')

  const [state, formAction, pending] = useActionState<PlanActionState, FormData>(
    continueOnboarding,
    {},
  )
  const errors = state.errors ?? {}

  const ctaLabel = plan === 'free' ? 'Continue with Free' : 'Select Pro plan'

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="plan" value={plan} />

      <div role="radiogroup" aria-label="Choose a plan" className="flex flex-col gap-4">
        <PlanCard
          selected={plan === 'free'}
          onSelect={() => setPlan('free')}
          title="Free"
          price={<><span className="font-display text-40 leading-none">$0</span> <span className="caption">forever</span></>}
          body="Unlimited projects, items, URL scraping, and Library access. Exports locked until you upgrade. No credit card required."
        />

        <PlanCard
          selected={plan === 'pro'}
          onSelect={() => setPlan('pro')}
          title="Pro"
          price={
            <>
              <span className="caption block" style={{ opacity: 0.7 }}>Starting from</span>
              <span className="font-display text-40 leading-none">$29</span>
              <span className="caption"> /mo</span>
            </>
          }
          body="Everything in Free — plus unlimited PDF spec sheets and shareable client links. Pick monthly or annual at checkout."
          accent
        />
      </div>

      <p className="caption mt-2" style={{ color: 'var(--fg-3)' }}>
        You can upgrade, downgrade, or cancel any time from Settings.
      </p>

      {errors.form && (
        <p className="body-sm" role="alert" style={{ color: 'var(--status-missing)' }}>
          {errors.form}
        </p>
      )}

      <div className="flex items-center justify-between mt-4">
        <a href="/onboarding/market" className="btn btn-text" aria-label="Back to step 3">
          <ArrowLeft size={16} /> Back
        </a>
        <Button type="submit" variant="dark" disabled={pending} aria-busy={pending}>
          {pending ? 'Working…' : ctaLabel} <ArrowRight size={16} />
        </Button>
      </div>
    </form>
  )
}

function PlanCard({
  selected,
  onSelect,
  title,
  price,
  body,
  accent,
}: {
  selected: boolean
  onSelect: () => void
  title: React.ReactNode
  price: React.ReactNode
  body: string
  accent?: boolean
}) {
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      onSelect()
    }
  }
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={onKey}
      className="card cursor-pointer"
      style={{
        borderColor: selected ? 'var(--ink-900)' : 'var(--border-1)',
        background: selected && accent ? 'var(--ink-900)' : 'var(--bg-surface)',
        color: selected && accent ? 'var(--paper-50)' : 'var(--fg-1)',
        boxShadow: selected ? 'var(--shadow-sm)' : 'none',
        outline: 'none',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center shrink-0"
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: '1.5px solid currentColor',
                opacity: selected ? 1 : 0.5,
              }}
              aria-hidden
            >
              {selected && <Check size={14} />}
            </span>
            <span className="h4" style={{ color: 'inherit' }}>{title}</span>
          </div>
          <p
            className="body-sm mt-3"
            style={{
              color: selected && accent ? 'rgba(250,247,242,0.78)' : 'var(--fg-2)',
            }}
          >
            {body}
          </p>
        </div>
        <div className="text-right shrink-0">{price}</div>
      </div>
    </div>
  )
}
