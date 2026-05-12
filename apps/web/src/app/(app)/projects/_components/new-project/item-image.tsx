// Stylized 200×200 product SVGs by item id. Originally lived in group-detail
// — we keep a subset here so the creating animation's Categories act and
// Moodboard hero cards can render real product imagery (matching the design's
// `window.ItemImage` reuse). When the group-detail screen lands for real,
// consider moving this back to a shared module.

interface ItemImageProps {
  id: string
  finishHex?: string
  size?: number | string
}

const W = 200

const VARIANTS: Record<string, (hex?: string) => React.ReactElement> = {
  // ---- Plumbing ----
  'plumb-1': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width={W} height={W} fill="#F3EEE6" />
      <ellipse cx={W / 2} cy={W - 18} rx="62" ry="6" fill="#000" opacity=".06" />
      <rect x="48" y="78" width="104" height="10" rx="5" fill={hex ?? '#B88550'} />
      <circle cx="62" cy="83" r="11" fill={hex ?? '#B88550'} />
      <circle cx="138" cy="83" r="11" fill={hex ?? '#B88550'} />
      <rect x="96" y="88" width="8" height="44" rx="2" fill={hex ?? '#B88550'} />
      <path d="M92 132 h16 l-3 14 h-10 z" fill={hex ?? '#B88550'} />
    </svg>
  ),
  'plumb-2': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F3EEE6" />
      <rect x="60" y="70" width="80" height="10" rx="5" fill={hex ?? '#C8C6C4'} />
      <rect x="92" y="80" width="16" height="50" rx="2" fill={hex ?? '#C8C6C4'} />
      <path d="M86 130 h28 l-4 14 h-20 z" fill={hex ?? '#C8C6C4'} />
    </svg>
  ),
  'plumb-3': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F3EEE6" />
      <ellipse cx={W / 2} cy="160" rx="60" ry="5" fill="#000" opacity=".06" />
      <circle cx="60" cy="120" r="10" fill={hex ?? '#A8A29A'} />
      <circle cx="140" cy="120" r="10" fill={hex ?? '#A8A29A'} />
      <rect x="92" y="60" width="16" height="60" rx="2" fill={hex ?? '#A8A29A'} />
      <path d="M92 60 q-12 -16 -28 -10" stroke={hex ?? '#A8A29A'} strokeWidth="6" fill="none" />
    </svg>
  ),
  'plumb-6': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F3EEE6" />
      <path d="M70 140 v-50 q0 -30 30 -30 q30 0 30 30" stroke={hex ?? '#1A1814'} strokeWidth="8" fill="none" strokeLinecap="round" />
      <rect x="92" y="58" width="16" height="20" rx="2" fill={hex ?? '#1A1814'} />
      <rect x="60" y="138" width="20" height="14" rx="2" fill={hex ?? '#1A1814'} />
    </svg>
  ),

  // ---- Lighting ----
  'light-1': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#EFE9DD" />
      <line x1="100" y1="20" x2="100" y2="70" stroke="#8B7757" strokeWidth="2" />
      <path d="M70 70 q30 -10 60 0 l-12 50 q-18 8 -36 0 z" fill={hex ?? '#C9A464'} />
      <ellipse cx="100" cy="125" rx="18" ry="3" fill="#FFE6A8" opacity=".75" />
    </svg>
  ),
  'light-2': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#EFE9DD" />
      <rect x="92" y="60" width="16" height="80" rx="3" fill={hex ?? '#1A1814'} />
      <circle cx="100" cy="64" r="14" fill={hex ?? '#1A1814'} />
      <ellipse cx="100" cy="50" rx="22" ry="7" fill="#FFE6A8" opacity=".55" />
    </svg>
  ),
  'light-3': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#EFE9DD" />
      <line x1="100" y1="20" x2="100" y2="70" stroke="#8B7757" strokeWidth="1.6" />
      <circle cx="100" cy="78" r="6" fill={hex ?? '#B88550'} />
      <path d="M50 90 q50 -22 100 0" stroke={hex ?? '#B88550'} strokeWidth="2" fill="none" />
      <circle cx="56" cy="92" r="6" fill={hex ?? '#B88550'} />
      <circle cx="100" cy="105" r="6" fill={hex ?? '#B88550'} />
      <circle cx="144" cy="92" r="6" fill={hex ?? '#B88550'} />
      <ellipse cx="56" cy="108" rx="6" ry="10" fill="#FFE6A8" opacity=".7" />
      <ellipse cx="100" cy="120" rx="6" ry="10" fill="#FFE6A8" opacity=".7" />
      <ellipse cx="144" cy="108" rx="6" ry="10" fill="#FFE6A8" opacity=".7" />
    </svg>
  ),
  'light-4': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#EFE9DD" />
      <ellipse cx="100" cy="170" rx="32" ry="5" fill="#000" opacity=".08" />
      <rect x="98" y="60" width="4" height="110" fill={hex ?? '#C9A464'} />
      <path d="M68 60 l64 0 -10 -34 -44 0 z" fill={hex ?? '#E6D7A8'} />
      <rect x="80" y="166" width="40" height="6" rx="2" fill={hex ?? '#C9A464'} />
    </svg>
  ),

  // ---- Tile ----
  'tile-1': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill={hex ?? '#E8DFCE'} />
      {[0, 1, 2, 3].map(r => (
        [0, 1, 2, 3].map(c => (
          <rect
            key={`${r}-${c}`}
            x={6 + c * 48} y={6 + r * 48}
            width="44" height="44" rx="2"
            fill={hex ?? '#E8DFCE'}
            stroke="rgba(0,0,0,.08)" strokeWidth="1"
            opacity={0.85 + ((r + c) % 2) * 0.15}
          />
        ))
      ))}
    </svg>
  ),
  'tile-2': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F3EEE6" />
      <g fill={hex ?? '#A89884'} stroke="rgba(0,0,0,.1)">
        {[0, 1, 2, 3, 4].map(r => (
          [0, 1, 2, 3, 4].map(c => (
            <rect
              key={`${r}-${c}`}
              x={c * 40} y={r * 40} width="32" height="14"
              transform={`rotate(${(r + c) % 2 ? 45 : -45} ${c * 40 + 16} ${r * 40 + 7})`}
            />
          ))
        ))}
      </g>
    </svg>
  ),
  'tile-3': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F3EEE6" />
      <g fill={hex ?? '#3F352B'} stroke="rgba(255,255,255,.6)" strokeWidth="1.5">
        {[0, 1, 2, 3].map(r => (
          [0, 1, 2, 3].map(c => {
            const cx = 30 + c * 48 + (r % 2 ? 24 : 0)
            const cy = 30 + r * 42
            const points = [0, 60, 120, 180, 240, 300]
              .map(a => {
                const rad = ((a - 30) * Math.PI) / 180
                return `${cx + 24 * Math.cos(rad)},${cy + 24 * Math.sin(rad)}`
              })
              .join(' ')
            return <polygon key={`${r}-${c}`} points={points} />
          })
        ))}
      </g>
    </svg>
  ),
  'tile-4': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill={hex ?? '#E8E4DC'} />
      <path d="M10 50 q40 -20 80 10 t100 -10" stroke="#8A8580" strokeWidth="1.2" fill="none" opacity=".55" />
      <path d="M-5 110 q60 30 120 -10 t90 20" stroke="#8A8580" strokeWidth="1.2" fill="none" opacity=".45" />
      <path d="M0 160 q50 -10 100 5 t100 -5" stroke="#8A8580" strokeWidth="1" fill="none" opacity=".35" />
    </svg>
  ),

  // ---- Hardware ----
  'hw-1': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F1EBDF" />
      <circle cx="100" cy="100" r="34" fill={hex ?? '#1A1814'} />
      <circle cx="100" cy="100" r="34" fill="none" stroke="rgba(0,0,0,.2)" />
      <circle cx="92" cy="92" r="8" fill="#fff" opacity=".25" />
    </svg>
  ),
  'hw-2': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F1EBDF" />
      <rect x="40" y="92" width="120" height="14" rx="7" fill={hex ?? '#B88550'} />
      <circle cx="50" cy="99" r="4" fill="#0006" />
      <circle cx="150" cy="99" r="4" fill="#0006" />
    </svg>
  ),
  'hw-3': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F1EBDF" />
      <rect x="50" y="50" width="40" height="100" rx="3" fill={hex ?? '#A8A29A'} />
      <rect x="110" y="50" width="40" height="100" rx="3" fill={hex ?? '#A8A29A'} />
      <rect x="92" y="40" width="16" height="120" rx="8" fill={hex ?? '#A8A29A'} />
      <circle cx="100" cy="60" r="3" fill="#0006" />
      <circle cx="100" cy="100" r="3" fill="#0006" />
      <circle cx="100" cy="140" r="3" fill="#0006" />
    </svg>
  ),
  'hw-4': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F1EBDF" />
      <rect x="60" y="80" width="80" height="40" rx="6" fill={hex ?? '#C9A464'} />
      <rect x="68" y="92" width="64" height="16" rx="3" fill="#0004" />
    </svg>
  ),

  // ---- Appliances ----
  'app-1': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F0EBE0" />
      <rect x="40" y="40" width="120" height="120" rx="6" fill={hex ?? '#1A1814'} />
      <rect x="48" y="48" width="104" height="56" rx="3" fill="#3a3631" />
      {[0, 1].map(r => (
        [0, 1].map(c => (
          <circle key={`${r}-${c}`} cx={68 + c * 64} cy={66 + r * 22} r="9" fill="#1A1814" stroke="#666" strokeWidth="1" />
        ))
      ))}
      <rect x="48" y="118" width="104" height="34" rx="3" fill="#2a2520" />
      <rect x="56" y="126" width="88" height="18" rx="2" fill="#0006" />
    </svg>
  ),
  'app-2': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F0EBE0" />
      <rect x="56" y="20" width="88" height="160" rx="6" fill={hex ?? '#C8C6C4'} stroke="#0002" />
      <line x1="56" y1="78" x2="144" y2="78" stroke="#0003" />
      <rect x="62" y="42" width="6" height="24" rx="2" fill="#0006" />
      <rect x="62" y="100" width="6" height="40" rx="2" fill="#0006" />
    </svg>
  ),
  'app-3': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F0EBE0" />
      <rect x="40" y="48" width="120" height="120" rx="6" fill={hex ?? '#A8A29A'} stroke="#0002" />
      <rect x="50" y="58" width="100" height="14" rx="2" fill="#0003" />
      <circle cx="60" cy="65" r="3" fill="#7BD18A" />
      <rect x="50" y="80" width="100" height="80" rx="3" fill="#0002" />
    </svg>
  ),
  'app-4': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F0EBE0" />
      <path d="M40 110 l30 -50 h60 l30 50 z" fill={hex ?? '#C9A464'} />
      <rect x="60" y="110" width="80" height="20" rx="3" fill={hex ?? '#C9A464'} />
      <rect x="74" y="116" width="52" height="6" rx="2" fill="#0004" />
    </svg>
  ),

  // ---- Paint / finish ----
  'paint-1': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill={hex ?? '#E8DFCE'} />
      <rect x="20" y="20" width={W - 40} height={W - 40} fill={hex ?? '#3F352B'} />
      <rect x="20" y="20" width={W - 40} height="22" fill="#fff" opacity=".15" />
    </svg>
  ),
  'paint-2': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill={hex ?? '#A89884'} />
      <rect x="0" y="120" width={W} height="80" fill="#0002" />
      <line x1="0" y1="120" x2={W} y2="120" stroke="#fff" strokeWidth="1" opacity=".4" />
    </svg>
  ),
  'paint-3': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F3EEE6" />
      <circle cx="80" cy="100" r="42" fill={hex ?? '#C06B3E'} />
      <circle cx="130" cy="100" r="42" fill={hex ?? '#3F352B'} opacity=".85" />
    </svg>
  ),
  'paint-4': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill={hex ?? '#E8DFCE'} />
      {[0, 1, 2, 3].map(i => (
        <rect
          key={i}
          x="20" y={20 + i * 40}
          width={W - 40} height="34"
          fill={hex ?? '#3F352B'}
          opacity={0.3 + i * 0.22}
        />
      ))}
    </svg>
  ),

  // ---- Cabinetry / millwork ----
  'cab-1': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F1EBDF" />
      <rect x="30" y="30" width="60" height="140" rx="2" fill={hex ?? '#8C7A63'} stroke="#0003" />
      <rect x="110" y="30" width="60" height="140" rx="2" fill={hex ?? '#8C7A63'} stroke="#0003" />
      <circle cx="84" cy="100" r="3" fill="#0007" />
      <circle cx="116" cy="100" r="3" fill="#0007" />
    </svg>
  ),

  // ---- Décor / staging ----
  'sofa-1': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F1EBDF" />
      <rect x="20" y="100" width="160" height="50" rx="14" fill={hex ?? '#A89884'} />
      <rect x="32" y="80" width="48" height="32" rx="8" fill={hex ?? '#BFAE96'} />
      <rect x="120" y="80" width="48" height="32" rx="8" fill={hex ?? '#BFAE96'} />
      <rect x="22" y="148" width="14" height="20" rx="3" fill="#5C4B38" />
      <rect x="164" y="148" width="14" height="20" rx="3" fill="#5C4B38" />
    </svg>
  ),
  'rug-1': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F1EBDF" />
      <rect x="20" y="40" width="160" height="120" rx="3" fill={hex ?? '#C06B3E'} />
      <rect x="30" y="50" width="140" height="100" fill="none" stroke="#fff8" strokeWidth="2" />
      <rect x="44" y="64" width="112" height="72" fill="none" stroke="#fff8" strokeDasharray="4 3" />
    </svg>
  ),
  'art-1': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F1EBDF" />
      <rect x="34" y="30" width="132" height="140" fill="#fff" stroke={hex ?? '#1A1814'} strokeWidth="3" />
      <circle cx="76" cy="80" r="14" fill="#C9A464" />
      <path d="M40 150 l30 -42 l28 22 l32 -50 l36 70 z" fill="#A89884" />
    </svg>
  ),
  'lamp-1': hex => (
    <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={W} fill="#F1EBDF" />
      <ellipse cx="100" cy="170" rx="24" ry="4" fill="#000" opacity=".1" />
      <rect x="96" y="100" width="8" height="68" fill={hex ?? '#3F352B'} />
      <path d="M70 100 l60 0 -8 -42 -44 0 z" fill={hex ?? '#E8DFCE'} />
      <rect x="84" y="168" width="32" height="6" rx="2" fill={hex ?? '#3F352B'} />
    </svg>
  ),
}

export function ItemImage({ id, finishHex, size }: ItemImageProps) {
  const render = VARIANTS[id] ?? VARIANTS['plumb-1']
  return (
    <div style={{
      width: '100%',
      height: typeof size === 'number' ? size : '100%',
      background: 'var(--paper-100)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {render(finishHex)}
    </div>
  )
}
