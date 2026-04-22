import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Logo } from './Logo'

export interface Crumb { label: ReactNode; href?: string }

export interface AppNavProps {
  crumbs?: Crumb[]
  right?: ReactNode
  logoHref?: string
  className?: string
}

/**
 * App chrome — single bar, breadcrumb-driven. Drop into an app shell layout.
 */
export function AppNav({ crumbs = [], right, logoHref = '/', className }: AppNavProps) {
  return (
    <nav className={cn('app-nav', className)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <Logo href={logoHref} />
        {crumbs.length > 0 && (
          <div className="crumbs">
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1
              const text = c.href && !isLast
                ? <a href={c.href} className="link-quiet">{c.label}</a>
                : <span className={isLast ? 'current' : undefined}>{c.label}</span>
              return (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  {text}
                  {!isLast && <span className="sep">/</span>}
                </span>
              )
            })}
          </div>
        )}
      </div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{right}</div>}
    </nav>
  )
}
