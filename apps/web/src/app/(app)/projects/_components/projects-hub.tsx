'use client'

import { useState, type MouseEvent } from 'react'
import Link from 'next/link'
import { ButtonLink } from '@speclyy/design-system'
import { ArrowRight, Folder, Plus } from '@speclyy/design-system/icons'
import { DEMO_PROJECTS } from '@/lib/projects/demo'
import type { DemoProject } from '@/lib/projects/types'
import { ProjectCover } from '../../_components/project-cover'

type Tab = 'yours' | 'samples'

interface ProjectsHubProps {
  yourProjects: DemoProject[]
  /** Where the various "New project" CTAs point. Carries any existing
      `?demo=populated` so the demo state survives the wizard hop. */
  newProjectHref: string
}

export function ProjectsHub({ yourProjects, newProjectHref }: ProjectsHubProps) {
  const [tab, setTab] = useState<Tab>('yours')
  const hasOwn = yourProjects.length > 0

  return (
    <>
      <PageTitle />
      <TabStrip tab={tab} onTab={setTab} />
      {tab === 'yours'
        ? hasOwn
          ? <YourProjectsPopulated projects={yourProjects} newProjectHref={newProjectHref} />
          : <YourProjectsEmpty onSeeSamples={() => setTab('samples')} newProjectHref={newProjectHref} />
        : <SampleProjectsView />}
    </>
  )
}

function PageTitle() {
  return (
    <div style={{ padding: '36px 48px 20px', background: 'var(--bg-surface)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Workspace</div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          fontWeight: 400,
          margin: 0,
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          color: 'var(--fg-1)',
          fontVariationSettings: '"opsz" 120, "SOFT" 30',
        }}>
          Projects
        </h1>
      </div>
    </div>
  )
}

function TabStrip({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const tabs: ReadonlyArray<[Tab, string]> = [
    ['yours',   'Your projects'],
    ['samples', 'Sample projects'],
  ]
  return (
    <div style={{
      padding: '0 48px',
      borderBottom: '1px solid var(--border-1)',
      background: 'var(--bg-surface)',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
    }}>
      {tabs.map(([k, label]) => {
        const on = tab === k
        return (
          <button
            key={k}
            type="button"
            onClick={() => onTab(k)}
            style={{
              padding: '14px 4px',
              marginRight: 22,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: on ? 600 : 500,
              color: on ? 'var(--fg-1)' : 'var(--fg-3)',
              borderBottom: `2px solid ${on ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1,
              transition: 'color var(--dur-fast)',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ---------- Card variants ----------

function liftIn(e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) {
  e.currentTarget.style.borderColor = 'var(--border-2)'
  e.currentTarget.style.transform = 'translateY(-2px)'
}
function liftOut(e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) {
  e.currentTarget.style.borderColor = 'var(--border-1)'
  e.currentTarget.style.transform = ''
}

function YourCard({ p }: { p: DemoProject }) {
  return (
    <Link
      href={`/projects/${p.id}`}
      onMouseEnter={liftIn}
      onMouseLeave={liftOut}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-1)',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color var(--dur-base), transform var(--dur-base)',
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <ProjectCover project={p} height={150} />
      <div style={{ padding: '16px 18px 18px' }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{p.phase}</div>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 400,
          margin: 0,
          lineHeight: 1.2,
          color: 'var(--fg-1)',
          fontVariationSettings: '"opsz" 96, "SOFT" 30',
        }}>{p.name}</h3>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--fg-3)' }}>{p.location}</div>

        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 3, background: 'var(--paper-200)', borderRadius: 999 }}>
            <div style={{
              width: `${Math.round(p.progress * 100)}%`,
              height: '100%',
              background: 'var(--accent)',
              borderRadius: 999,
            }} />
          </div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
            {p.items} items
          </span>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--fg-4)' }}>
          Updated {p.updated.toLowerCase()}
        </div>
      </div>
    </Link>
  )
}

function SampleCard({ p }: { p: DemoProject }) {
  return (
    <Link
      href={`/projects/${p.id}`}
      onMouseEnter={liftIn}
      onMouseLeave={liftOut}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-1)',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color var(--dur-base), transform var(--dur-base)',
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ position: 'relative', borderBottom: '1px solid var(--border-1)' }}>
        <ProjectCover project={p} height={180} />
      </div>
      <div style={{ padding: '18px 20px 20px' }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>{p.type}</div>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 400,
          margin: 0,
          lineHeight: 1.2,
          color: 'var(--fg-1)',
          fontVariationSettings: '"opsz" 96, "SOFT" 30',
        }}>{p.name}</h3>
        <div style={{
          marginTop: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
          color: 'var(--fg-3)',
        }}>
          <span>{p.location}</span>
          <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--fg-4)' }} />
          <span>{p.groups} groups</span>
          <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--fg-4)' }} />
          <span>{p.items} items</span>
        </div>
      </div>
    </Link>
  )
}

// ---------- Content views ----------

function YourProjectsPopulated({
  projects, newProjectHref,
}: {
  projects: DemoProject[]
  newProjectHref: string
}) {
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 48px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {projects.map(p => <YourCard key={p.id} p={p} />)}
          <NewProjectTile href={newProjectHref} />
        </div>
      </div>
    </div>
  )
}

function NewProjectTile({ href }: { href: string }) {
  return (
    <Link
      href={href}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent)'
        e.currentTarget.style.color = 'var(--accent)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-3)'
        e.currentTarget.style.color = 'var(--fg-3)'
      }}
      style={{
        minHeight: 320,
        background: 'transparent',
        border: '1px dashed var(--border-3)',
        borderRadius: 14,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        color: 'var(--fg-3)',
        textDecoration: 'none',
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        fontWeight: 500,
        transition: 'border-color var(--dur-fast), color var(--dur-fast)',
      }}
    >
      <Plus size={20} />
      New project
    </Link>
  )
}

function YourProjectsEmpty({
  onSeeSamples, newProjectHref,
}: {
  onSeeSamples: () => void
  newProjectHref: string
}) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 48px 80px',
    }}>
      <div style={{
        maxWidth: 520,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: 'var(--paper-100)',
          border: '1px solid var(--border-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
          marginBottom: 24,
        }}>
          <Folder size={24} strokeWidth={1.4} />
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 40,
          fontWeight: 400,
          margin: 0,
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          color: 'var(--fg-1)',
          fontVariationSettings: '"opsz" 144, "SOFT" 40',
        }}>
          Start your <span className="italic-serif">first project</span>.
        </h1>
        <p style={{
          margin: '16px 0 32px',
          fontSize: 16,
          color: 'var(--fg-3)',
          lineHeight: 1.6,
          maxWidth: 420,
        }}>
          A project holds the items, groups, and spec sheet for one client engagement.
          Most designers start with a single room — you can always add more.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <ButtonLink variant="primary" size="lg" href={newProjectHref}>
            <Plus size={16} /> Create your first project
          </ButtonLink>
          <button
            type="button"
            onClick={onSeeSamples}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--fg-2)',
              padding: '8px 4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Explore sample projects
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function SampleProjectsView() {
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 48px 12px' }}>
        <p style={{
          margin: 0,
          fontSize: 14,
          color: 'var(--fg-3)',
          lineHeight: 1.6,
          maxWidth: 560,
        }}>
          Four worked examples across the launch markets. Open any one to see how
          items, groups, and the exported spec sheet come together.
        </p>
      </div>
      <div style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: '24px 48px 80px',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 24,
      }}>
        {DEMO_PROJECTS.map(p => <SampleCard key={p.id} p={p} />)}
      </div>
    </div>
  )
}
