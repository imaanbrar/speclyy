import type { CSSProperties } from 'react'

// Lucide-style 24×24 path data — stroke 1.5 by default to match the editorial
// pencil-line tone. Kept here (not in design-system) because these glyphs are
// only used inside the New Project wizard and don't belong in the shared kit.
export const NP_ICON_PATHS = {
  drop:      'M12 3s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z',
  bulb:      'M9 18h6m-3-15a7 7 0 0 0-4 12c1 1 1 2 1 3v0h6v0c0-1 0-2 1-3a7 7 0 0 0-4-12z',
  brush:     'M3 21c0-3 3-3 3-6m3 6c0-3 3-3 3-6 M14 4l6 6-7 7c-2 2-6 2-8 0s-2-6 0-8z',
  bed:       'M3 21V7m0 4h18v10 M7 11V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3',
  sofa:      'M3 13a2 2 0 0 1 2-2v-1a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1a2 2 0 0 1 2 2v5H3z M5 18v2 M19 18v2',
  table:     'M3 8h18v2H3z M5 10v8 M19 10v8',
  spray:     'M9 4h4 M9 8h4 M8 12h6v9H8z M14 4v8',
  utensil:   'M5 3v8a2 2 0 0 0 4 0V3M7 11v10 M19 3c-1 2-2 4-2 6s1 3 2 3v9',
  hardware:  'M21 11a4 4 0 0 1-7 3l-7 7-3-3 7-7a4 4 0 0 1 3-7 4 4 0 0 1 4 4z',
  appliance: 'M5 3h14v18H5z M5 8h14 M9 13h.01 M9 17h.01',
  door:      'M5 21h14 M7 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16 M14 12h.01',
  window:    'M4 4h16v16H4z M12 4v16 M4 12h16',
  building:  'M3 21h18 M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16 M9 7h.01 M9 11h.01 M9 15h.01 M14 7h.01 M14 11h.01 M14 15h.01',
  hall:      'M5 3v18 M19 3v18 M5 12h14',
  meeting:   'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M3 20a6 6 0 0 1 12 0 M16 14a4 4 0 1 1 5 4',
  cafe:      'M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z M16 8h2a3 3 0 0 1 0 6h-2 M6 5V3 M10 5V3 M14 5V3',
  globe:     'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3a13 13 0 0 1 0 18 13 13 0 0 1 0-18z',
  layers:    'M3 6h18M3 12h18M3 18h18',
  image:     'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 17l5-5 5 5 4-4 4 4 M9 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  link:      'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  sparkle:   'M12 3l1.8 4.4L18 9l-4.2 1.6L12 15l-1.8-4.4L6 9l4.2-1.6zM5 17l.9 2.1L8 20l-2.1.9L5 23l-.9-2.1L2 20l2.1-.9z',
  upload:    'M12 21V9m-5 5 5-5 5 5 M5 3h14',
  edit:      'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
} as const

interface NPIconProps {
  d: string
  size?: number
  sw?: number
  style?: CSSProperties
  color?: string
}

export function NPIcon({ d, size = 18, sw = 1.5, style, color }: NPIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      aria-hidden
    >
      <path d={d} />
    </svg>
  )
}

interface GlyphProps {
  d: string | readonly string[]
  size?: number
  sw?: number
  style?: CSSProperties
}

// Multi-path SVG glyph for the creating-screen animation. Renders each path
// in the array as its own <path/> so complex line-art (kitchen, bath, etc.)
// reads as a single stroked composition.
export function Glyph({ d, size = 28, sw = 1.6, style }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden
    >
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d as string} />}
    </svg>
  )
}
