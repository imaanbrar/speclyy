'use client'

import { useActionState } from 'react'
import { Button, Field, Input } from '@speclyy/design-system'
import { ArrowRight } from '@speclyy/design-system/icons'
import { saveName, type NameActionState } from '../actions'

interface NameFormProps {
  email: string
  initial: { first_name: string; last_name: string }
}

export function NameForm({ email, initial }: NameFormProps) {
  const [state, formAction, pending] = useActionState<NameActionState, FormData>(saveName, {
    values: initial,
  })

  const values = state.values ?? initial
  const errors = state.errors ?? {}

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Field label="First name" htmlFor="first_name" error={errors.first_name}>
        <Input
          id="first_name"
          name="first_name"
          defaultValue={values.first_name}
          required
          minLength={2}
          maxLength={40}
          autoComplete="given-name"
          autoFocus
          aria-invalid={Boolean(errors.first_name)}
          aria-describedby={errors.first_name ? 'first_name-err' : undefined}
        />
      </Field>

      <Field label="Last name" htmlFor="last_name" error={errors.last_name}>
        <Input
          id="last_name"
          name="last_name"
          defaultValue={values.last_name}
          required
          minLength={2}
          maxLength={40}
          autoComplete="family-name"
          aria-invalid={Boolean(errors.last_name)}
          aria-describedby={errors.last_name ? 'last_name-err' : undefined}
        />
      </Field>

      {errors.form && (
        <p className="body-sm" role="alert" style={{ color: 'var(--status-missing)' }}>
          {errors.form}
        </p>
      )}

      <div className="flex items-center justify-between mt-4">
        <p className="caption">
          Signed in as <strong style={{ color: 'var(--fg-1)' }}>{email}</strong>
        </p>
        <Button type="submit" variant="dark" disabled={pending} aria-busy={pending}>
          {pending ? 'Saving…' : 'Continue'} <ArrowRight size={16} />
        </Button>
      </div>
    </form>
  )
}
