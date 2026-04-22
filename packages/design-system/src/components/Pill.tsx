import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

type Tone = 'complete' | 'tbd' | 'missing' | 'neutral' | 'accent'

export interface PillProps {
  tone?: Tone
  dot?: boolean
  children: ReactNode
  className?: string
}

export function Pill({ tone = 'neutral', dot, children, className }: PillProps) {
  const withDot = dot ?? (tone !== 'neutral' && tone !== 'accent')
  return (
    <span className={cn('pill', `pill-${tone}`, className)}>
      {withDot && <span className="dot" />}
      {children}
    </span>
  )
}
