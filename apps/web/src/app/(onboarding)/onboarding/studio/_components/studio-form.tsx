'use client'

import { useActionState, useState } from 'react'
import { Button, Field, Input } from '@speclyy/design-system'
import { ArrowLeft, ArrowRight } from '@speclyy/design-system/icons'
import { saveStudio, skipStudio, type StudioActionState } from '../actions'

interface StudioFormProps {
  initial: { name: string; size: string }
}

const SIZES = [
  { value: 'solo', label: 'Just me' },
  { value: '2_5', label: '2–5' },
  { value: '6_10', label: '6–10' },
  { value: '11_plus', label: '11+' },
] as const

export function StudioForm({ initial }: StudioFormProps) {
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(saveStudio, {
    values: initial,
  })

  const [size, setSize] = useState<string>(state.values?.size ?? initial.size)
  const errors = state.errors ?? {}
  const values = state.values ?? initial

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <Field
        label="Studio name"
        htmlFor="name"
        helper="The name appears on the letterhead of every PDF you export. You can change it later in Settings."
        error={errors.name}
      >
        <Input
          id="name"
          name="name"
          defaultValue={values.name}
          required
          minLength={2}
          maxLength={80}
          autoFocus
          autoComplete="organization"
          placeholder="Henley & Co."
          aria-invalid={Boolean(errors.name)}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="caption" style={{ fontWeight: 600, color: 'var(--fg-2)', letterSpacing: '0.02em' }}>
          Studio size
        </legend>
        <input type="hidden" name="size" value={size} />
        <div role="radiogroup" aria-label="Studio size" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SIZES.map((opt) => {
            const active = size === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSize(opt.value)}
                className="btn"
                style={{
                  background: active ? 'var(--ink-900)' : 'var(--bg-surface)',
                  color: active ? 'var(--paper-50)' : 'var(--fg-1)',
                  border: '1px solid var(--border-2)',
                  justifyContent: 'center',
                  fontWeight: 500,
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        {errors.size && (
          <span className="helper helper-error" role="alert">
            {errors.size}
          </span>
        )}
      </fieldset>

      {errors.form && (
        <p className="body-sm" role="alert" style={{ color: 'var(--status-missing)' }}>
          {errors.form}
        </p>
      )}

      <div className="flex items-center justify-between mt-2">
        <a href="/onboarding/name" className="btn btn-text" aria-label="Back to step 1">
          <ArrowLeft size={16} /> Back
        </a>
        <div className="flex items-center gap-2">
          <Button type="submit" formAction={skipStudio} variant="text" disabled={pending}>
            Skip for now
          </Button>
          <Button type="submit" variant="dark" disabled={pending} aria-busy={pending}>
            {pending ? 'Saving…' : 'Continue'} <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </form>
  )
}
