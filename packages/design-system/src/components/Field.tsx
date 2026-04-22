import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface FieldProps {
  label: ReactNode
  helper?: ReactNode
  error?: ReactNode
  optional?: boolean
  className?: string
  children: ReactNode
  htmlFor?: string
}

export function Field({ label, helper, error, optional, className, children, htmlFor }: FieldProps) {
  return (
    <div className={cn('field', className)}>
      <label htmlFor={htmlFor}>
        {label}
        {optional && <span style={{ color: 'var(--fg-4)', fontWeight: 400 }}> (optional)</span>}
      </label>
      {children}
      {error
        ? <span className="helper helper-error">{error}</span>
        : helper && <span className="helper">{helper}</span>}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn('input', className)} {...rest} />
  }
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...rest }, ref) {
    return <select ref={ref} className={cn('select', className)} {...rest} />
  }
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn('textarea', className)} {...rest} />
  }
)
