import { Suspense } from 'react'
import { Sidebar } from './_components/sidebar'
import { NewProjectWizard } from './projects/_components/new-project'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: 'var(--bg-app)',
    }}>
      {/* Suspense boundary because Sidebar reads URL search params via
          useSearchParams, which forces client-side bailout. */}
      <Suspense fallback={<div style={{ width: 220, flexShrink: 0 }} />}>
        <Sidebar />
      </Suspense>
      <main style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {children}
      </main>
      {/* Wizard reads `?new=1` from URL and overlays the whole app when
          present. Lives at layout level so any New project trigger — TopBar,
          sidebar, hub tile — can open it via a plain Link. */}
      <Suspense fallback={null}>
        <NewProjectWizard />
      </Suspense>
    </div>
  )
}
