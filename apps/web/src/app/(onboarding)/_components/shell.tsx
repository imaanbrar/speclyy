import type { ReactNode } from 'react'
import { Logo } from '@speclyy/design-system'
import { OnboardingProgress } from './progress'

interface ShellProps {
  step: 1 | 2 | 3 | 4
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  children: ReactNode
}

/**
 * Shared onboarding chrome: logo header, progress, centered card, footer.
 * Step pages render their form inside the `children` slot. Keeping the shape
 * here means a future progress-indicator change ripples through every step.
 */
export function OnboardingShell({ step, eyebrow, title, description, children }: ShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-app">
      <header className="flex items-center justify-between px-6 md:px-10 py-6">
        <Logo href="/" />
        <span className="eyebrow">Step {step} of 4</span>
      </header>

      <main className="flex-1 grid place-items-center px-6 pb-16">
        <div className="w-full max-w-xl">
          <OnboardingProgress step={step} />
          <p className="eyebrow mt-8">{eyebrow}</p>
          <h1 className="h1 mt-3">{title}</h1>
          {description && <p className="body-lg mt-4 max-w-lg">{description}</p>}
          <div className="mt-10">{children}</div>
        </div>
      </main>

      <footer className="px-6 md:px-10 py-6 flex items-center justify-between caption">
        <span>© Speclyy 2026</span>
        <div className="flex items-center gap-4">
          <a href="/privacy" className="link-quiet">Privacy</a>
          <span aria-hidden>·</span>
          <a href="/terms" className="link-quiet">Terms</a>
          <span aria-hidden>·</span>
          <form action="/auth/sign-out" method="post" className="inline">
            <button type="submit" className="link-quiet" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }}>
              Sign out
            </button>
          </form>
        </div>
      </footer>
    </div>
  )
}
