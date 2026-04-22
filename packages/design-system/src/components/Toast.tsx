import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Check } from '../icons'

export interface ToastProps {
  title: ReactNode
  sub?: ReactNode
  icon?: ReactNode
  className?: string
}

export function Toast({ title, sub, icon, className }: ToastProps) {
  return (
    <div className={cn('toast', className)} role="status">
      {icon ?? <Check size={20} />}
      <div>
        <div className="title">{title}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
    </div>
  )
}
