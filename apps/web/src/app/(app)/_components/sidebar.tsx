'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Book, Bookmark, Folder, Globe, Plus } from '@speclyy/design-system/icons'
import { DEMO_PROJECTS } from '@/lib/projects/demo'

// Speclyy wordmark — Fraunces composition matching the design's inline mark.
// We don't use the PNG Logo here because the sidebar variant needs a precise
// 22px size that lines up with the nav rail's typographic rhythm.
function SpeclyyMark({ size = 22 }: { size?: number }) {
  return (
    <span style={{
      fontFamily: 'var(--font-display)',
      fontSize: size,
      fontWeight: 400,
      color: 'var(--fg-1)',
      letterSpacing: '-0.01em',
      fontVariationSettings: '"opsz" 72, "SOFT" 30',
      display: 'inline-flex',
      alignItems: 'baseline',
    }}>
      <span style={{ fontStyle: 'italic' }}>spec</span>
      <span>lyy</span>
      <span style={{ color: 'var(--accent)', marginLeft: 1 }}>✦</span>
    </span>
  )
}

interface NavItem {
  key: string
  label: string
  icon: typeof Folder
  href: string
  enabled: boolean
}

const NAV: readonly NavItem[] = [
  { key: 'projects',   label: 'Projects',   icon: Folder,   href: '/projects',   enabled: true  },
  { key: 'library',    label: 'Library',    icon: Book,     href: '/library',    enabled: false },
  { key: 'my-library', label: 'My Library', icon: Bookmark, href: '/my-library', enabled: false },
  { key: 'markets',    label: 'Markets',    icon: Globe,    href: '/markets',    enabled: false },
]

export function Sidebar() {
  const pathname = usePathname()
  const sp = useSearchParams()
  const populated = sp.get('demo') === 'populated'

  // Active projects in the rail mirror "Your projects" on the hub. Filter out
  // complete projects — they shouldn't crowd the active list.
  const projects = (populated ? DEMO_PROJECTS.slice(0, 3) : []).filter(
    p => p.statusKind !== 'complete',
  )

  const activeProjectId = pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? null
  const activeNavKey =
    pathname.startsWith('/projects')   ? 'projects' :
    pathname.startsWith('/library')    ? 'library' :
    pathname.startsWith('/my-library') ? 'my-library' :
    pathname.startsWith('/markets')    ? 'markets' :
    null

  return (
    <aside style={{
      width: 220,
      background: 'var(--paper-50)',
      borderRight: '1px solid var(--border-1)',
      padding: '18px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      flexShrink: 0,
    }}>
      <div style={{ padding: '6px 12px 18px' }}>
        <Link href="/projects" aria-label="Speclyy" style={{ textDecoration: 'none' }}>
          <SpeclyyMark size={22} />
        </Link>
      </div>

      {NAV.map(item => {
        const Icon = item.icon
        const on = item.key === activeNavKey
        const inner = (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 8,
            background: on ? 'var(--paper-200)' : 'transparent',
            color: on ? 'var(--fg-1)' : item.enabled ? 'var(--fg-2)' : 'var(--fg-4)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: on ? 600 : 500,
            cursor: item.enabled ? 'pointer' : 'not-allowed',
          }}>
            <Icon size={17} /> {item.label}
          </span>
        )
        return item.enabled ? (
          <Link key={item.key} href={item.href} style={{ textDecoration: 'none' }}>
            {inner}
          </Link>
        ) : (
          <span key={item.key} aria-disabled="true" title="Coming soon">
            {inner}
          </span>
        )
      })}

      {projects.length > 0 && (
        <>
          <div style={{ marginTop: 22, marginBottom: 8, padding: '0 12px' }}>
            <div className="eyebrow" style={{ fontSize: 10 }}>Active projects</div>
          </div>
          {projects.map(p => {
            const isActive = p.id === activeProjectId
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 12px', borderRadius: 8,
                  background: isActive ? 'var(--paper-200)' : 'transparent',
                  textDecoration: 'none',
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                  background: `linear-gradient(135deg, ${p.palette[0]}, ${p.palette[2]})`,
                }}/>
                <span style={{
                  fontSize: 13, color: 'var(--fg-2)',
                  minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontWeight: isActive ? 600 : 500,
                }}>{p.name}</span>
              </Link>
            )
          })}
        </>
      )}

      <div style={{ marginTop: 'auto', padding: '0 12px' }}>
        <Link
          href={populated ? '/projects?demo=populated&new=1' : '/projects?new=1'}
          style={{
            width: '100%', padding: 8, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'transparent', border: '1px dashed var(--border-3)',
            color: 'var(--fg-3)', cursor: 'pointer', textDecoration: 'none',
            fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
          }}
        >
          <Plus size={14} /> New project
        </Link>
      </div>
    </aside>
  )
}
