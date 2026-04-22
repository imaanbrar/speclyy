import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Speclyy — Design system',
  description: 'The Speclyy design system: tokens, components, and patterns.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-app text-ink-900 font-body antialiased">{children}</body>
    </html>
  )
}
