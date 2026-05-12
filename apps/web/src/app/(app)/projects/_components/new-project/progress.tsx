import { Check } from '@speclyy/design-system/icons'

interface NPProgressProps {
  steps: readonly string[]
  current: number
}

export function NPProgress({ steps, current }: NPProgressProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {steps.map((label, i) => {
        const isPast = i < current
        const isCurrent = i === current
        return (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 22, height: 22, borderRadius: 999, flexShrink: 0,
                border: `1.5px solid ${isPast || isCurrent ? 'var(--ink-900)' : 'var(--border-3)'}`,
                background: isPast ? 'var(--ink-900)' : 'var(--bg-surface)',
                color: isPast ? 'var(--paper-50)' : isCurrent ? 'var(--ink-900)' : 'var(--fg-3)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
                transition: 'all var(--dur-base)',
              }}>
                {isPast ? <Check size={11} strokeWidth={2.6} /> : i + 1}
              </span>
              <span style={{
                fontSize: 12,
                fontWeight: isCurrent ? 600 : 500,
                color: isPast || isCurrent ? 'var(--fg-1)' : 'var(--fg-3)',
                letterSpacing: '0.02em',
              }}>{label}</span>
            </span>
            {i < steps.length - 1 && (
              <span style={{
                width: 28, height: 1,
                background: isPast ? 'var(--ink-900)' : 'var(--border-2)',
              }} />
            )}
          </span>
        )
      })}
    </div>
  )
}
