'use client'

import type { NPData, NPProjectType } from './types'

interface NameStepProps {
  data: NPData
  onChange: (patch: Partial<NPData>) => void
  type: NPProjectType | undefined
}

export function NameStep({ data, onChange, type }: NameStepProps) {
  const placeholder =
    type?.id === 'staging' ? '2401 Vista Pkwy listing' :
    type?.id === 'decor'   ? 'Henley living room refresh' :
    'Atherton Residence'

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 22 }}>
        <label
          htmlFor="np-project-name"
          style={{
            display: 'block', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--fg-3)', marginBottom: 8,
          }}
        >Project name</label>
        <input
          id="np-project-name"
          autoFocus
          value={data.name ?? ''}
          onChange={e => onChange({ name: e.target.value })}
          placeholder={placeholder}
          style={{
            width: '100%', padding: '16px 18px',
            background: 'var(--bg-surface)', border: '1.5px solid var(--border-3)',
            borderRadius: 12, fontSize: 22, fontFamily: 'var(--font-display)',
            fontWeight: 400, color: 'var(--fg-1)', outline: 'none',
            fontVariationSettings: '"opsz" 72, "SOFT" 30',
          }}
        />
      </div>
      <div style={{ maxWidth: 320 }}>
        <label
          htmlFor="np-project-client"
          style={{
            display: 'block', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--fg-3)', marginBottom: 8,
          }}
        >Client (optional)</label>
        <input
          id="np-project-client"
          value={data.client ?? ''}
          onChange={e => onChange({ client: e.target.value })}
          placeholder="Henley & Co."
          style={{
            width: '100%', padding: '12px 14px',
            background: 'var(--bg-surface)', border: '1px solid var(--border-3)',
            borderRadius: 10, fontSize: 14, fontFamily: 'var(--font-body)',
            color: 'var(--fg-1)', outline: 'none',
          }}
        />
      </div>
    </div>
  )
}
