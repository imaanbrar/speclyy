import type { ReactNode } from 'react'
import Link from 'next/link'
import { Bell, ChevronRight } from '@speclyy/design-system/icons'
import { AccountMenu } from '@/components/account-menu'

export interface TopBarCrumb {
  label: string
  href?: string
}

interface TopBarProps {
  crumbs: TopBarCrumb[]
  actions?: ReactNode
  initials: string
  email: string | null
}

export function TopBar({ crumbs, actions, initials, email }: TopBarProps) {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '14px 28px',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-1)',
      minHeight: 56,
      flexShrink: 0,
    }}>
      <nav style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1
          const text = (
            <span style={{
              fontSize: 14,
              fontWeight: isLast ? 600 : 500,
              color: isLast ? 'var(--fg-1)' : 'var(--fg-3)',
              whiteSpace: 'nowrap',
              textDecoration: 'none',
            }}>{c.label}</span>
          )
          return (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {i > 0 && (
                <span style={{ color: 'var(--fg-4)', display: 'inline-flex' }}>
                  <ChevronRight size={14} />
                </span>
              )}
              {c.href && !isLast
                ? <Link href={c.href} style={{ textDecoration: 'none' }}>{text}</Link>
                : text}
            </span>
          )
        })}
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {actions}
        <span style={{ width: 1, height: 22, background: 'var(--border-2)', margin: '0 4px' }} />
        <button
          type="button"
          aria-label="Notifications"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--fg-2)', padding: 6, display: 'inline-flex',
          }}
        >
          <Bell size={18} />
        </button>
        <AccountMenu initials={initials} title={email ?? 'Your account'} />
      </div>
    </header>
  )
}
