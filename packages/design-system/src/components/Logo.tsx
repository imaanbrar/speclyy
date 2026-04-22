import { cn } from '../lib/cn'

export interface LogoProps {
  /** Which surface the logo is sitting on. `light` = dark ink on paper; `dark` = cream on ink. */
  tone?: 'light' | 'dark'
  /** Rendered height in px. Width scales proportionally. */
  height?: number
  className?: string
  href?: string
  /** Override the image source (defaults to /logos/speclyy-logo-{tone}.png). */
  src?: string
}

/**
 * Speclyy wordmark — italic "spec", upright bold "lyy". Type-set in Fraunces.
 * Renders the authoritative PNG; never recolor, never add a sparkle, never rebuild in sans.
 * Expects `/logos/speclyy-logo-{light,dark}.png` in the host app's public directory.
 */
export function Logo({ tone = 'light', height = 28, href, className, src }: LogoProps) {
  const resolved = src ?? `/logos/speclyy-logo-${tone === 'dark' ? 'dark' : 'light'}.png`
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt="Speclyy"
      style={{ height, width: 'auto', display: 'block' }}
      draggable={false}
    />
  )
  const classes = cn('logo', className)
  return href
    ? <a href={href} className={classes} aria-label="Speclyy">{img}</a>
    : <span className={classes} aria-label="Speclyy">{img}</span>
}
