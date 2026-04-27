interface OnboardingProgressProps {
  step: 1 | 2 | 3 | 4
}

const TOTAL = 4

export function OnboardingProgress({ step }: OnboardingProgressProps) {
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: TOTAL }).map((_, i) => {
          const active = i + 1 === step
          const past = i + 1 < step
          return (
            <span
              key={i}
              className="block rounded-full transition-colors"
              style={{
                width: 24,
                height: 3,
                background: active
                  ? 'var(--ink-900)'
                  : past
                    ? 'var(--ink-500)'
                    : 'var(--ink-300)',
              }}
            />
          )
        })}
      </div>
      <span className="eyebrow" role="status" aria-live="polite">
        Step {step} of {TOTAL}
      </span>
    </div>
  )
}
