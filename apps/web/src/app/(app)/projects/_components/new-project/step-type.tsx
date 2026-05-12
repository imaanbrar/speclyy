'use client'

import type { MouseEvent } from 'react'
import { Check, Sparkle } from '@speclyy/design-system/icons'
import { ProjectCover } from '../../../_components/project-cover'
import { NP_TYPES, type NPProjectTypeId, type NPProjectType } from './types'

interface TypePickerProps {
  value?: NPProjectTypeId
  customLabel?: string
  onChange: (id: NPProjectTypeId) => void
  onCustomLabel: (next: string) => void
}

export function TypePicker({ value, customLabel, onChange, onCustomLabel }: TypePickerProps) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, padding: '0 32px',
    }}>
      {NP_TYPES.map(t => (
        <TypeTile
          key={t.id}
          type={t}
          on={value === t.id}
          customLabel={customLabel}
          onClick={() => onChange(t.id)}
          onCustomLabel={onCustomLabel}
        />
      ))}
    </div>
  )
}

interface TypeTileProps {
  type: NPProjectType
  on: boolean
  customLabel?: string
  onClick: () => void
  onCustomLabel: (next: string) => void
}

function TypeTile({ type, on, customLabel, onClick, onCustomLabel }: TypeTileProps) {
  // Live preview uses the canonical ProjectCover so the tile reads exactly
  // like the post-creation hub card.
  const mockProject = {
    id: `np-${type.id}`,
    name: type.label,
    type: type.label,
    typeKey: type.cover,
    location: '',
    client: '',
    market: '',
    phase: '',
    status: '',
    statusKind: 'neutral' as const,
    progress: 0,
    groups: 0,
    items: 0,
    updated: '',
    palette: [...type.palette, type.palette[0]] as readonly [string, string, string, string],
    accent: type.accent,
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'var(--bg-surface)',
        border: `1.5px solid ${on ? 'var(--ink-900)' : 'var(--border-1)'}`,
        boxShadow: on ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        borderRadius: 14, overflow: 'hidden',
        cursor: 'pointer', textAlign: 'left', padding: 0,
        transition: 'all var(--dur-base) var(--ease-out)',
        transform: on ? 'translateY(-2px)' : 'translateY(0)',
        fontFamily: 'inherit',
        position: 'relative',
      }}
    >
      <div style={{ height: 130, position: 'relative' }}>
        {type.custom ? (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg, var(--paper-100), var(--paper-200))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--fg-3)',
          }}>
            <Sparkle size={32} />
          </div>
        ) : (
          <ProjectCover project={mockProject} height={130} />
        )}
        {on && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            width: 28, height: 28, borderRadius: 999,
            background: 'var(--ink-900)', color: 'var(--paper-50)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            animation: 'speclyy-pulse 1800ms infinite',
          }}><Check size={14} strokeWidth={2.6} /></div>
        )}
      </div>

      <div style={{ padding: '16px 18px 18px' }}>
        {type.custom && on ? (
          <input
            autoFocus
            value={customLabel ?? ''}
            onChange={e => onCustomLabel(e.target.value)}
            onClick={(e: MouseEvent<HTMLInputElement>) => e.stopPropagation()}
            placeholder="Name your project type"
            style={{
              width: '100%', padding: '4px 0',
              background: 'transparent', border: 'none', outline: 'none',
              borderBottom: '1.5px solid var(--accent)',
              fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.1,
              fontVariationSettings: '"opsz" 96, "SOFT" 30',
              color: 'var(--fg-1)', fontWeight: 400,
            }}
          />
        ) : (
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.1,
            fontVariationSettings: '"opsz" 96, "SOFT" 30',
            color: 'var(--fg-1)', fontWeight: 400,
          }}>{type.label}</div>
        )}
        <div style={{ fontSize: 12, marginTop: 4, color: 'var(--fg-3)' }}>{type.sub}</div>
        {type.custom && (
          <div style={{
            display: 'flex', gap: 4, marginTop: 12, flexWrap: 'wrap', minHeight: 22,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
              padding: '3px 8px', borderRadius: 999,
              background: 'var(--terracotta-50)', color: 'var(--accent)',
            }}>You name it</span>
          </div>
        )}
      </div>
    </button>
  )
}
