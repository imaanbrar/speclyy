import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Speclyy Boards',
  description: 'Standalone mood boards for interior designers.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-app text-ink-900 font-body antialiased">{children}</body>
    </html>
  )
}
