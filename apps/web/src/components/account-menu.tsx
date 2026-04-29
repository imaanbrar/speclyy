'use client'

import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@speclyy/design-system'

interface AccountMenuProps {
  initials: string
  title?: string
}

/**
 * Avatar + popover with a "Sign out" entry. The sign-out itself is a native
 * form POST to `/auth/sign-out` — the resulting full page load discards every
 * in-memory client cache (React Query, Zustand, etc.) so the next login on
 * the same browser starts clean.
 */
export function AccountMenu({ initials, title = 'Your account' }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={title}
        style={{
          background: 'transparent',
          border: 0,
          padding: 0,
          cursor: 'pointer',
          borderRadius: '999px',
        }}
      >
        <Avatar initials={initials} title={title} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            minWidth: 180,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-1)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            padding: 6,
            zIndex: 50,
          }}
        >
          <a
            href="/account"
            role="menuitem"
            className="body-sm"
            style={{
              display: 'block',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--fg-1)',
              textDecoration: 'none',
            }}
          >
            Account
          </a>
          <form action="/auth/sign-out" method="post" style={{ margin: 0 }}>
            <button
              type="submit"
              role="menuitem"
              className="body-sm"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                border: 0,
                color: 'var(--fg-1)',
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
