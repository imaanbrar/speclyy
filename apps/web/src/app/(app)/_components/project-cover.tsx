import type { DemoProject } from '@/lib/projects/types'

interface ProjectCoverProps {
  project: DemoProject
  height?: number
}

// Editorial SVG covers — one composition per project archetype, painted from
// the project's own four-color palette. Avoids stock photography so covers
// feel calmer and on-brand offline.
export function ProjectCover({ project, height = 280 }: ProjectCoverProps) {
  const [a, b, c, d] = project.palette
  const { accent, typeKey, id } = project
  const gradId = `cover-sky-${id}`

  return (
    <div style={{ width: '100%', height, position: 'relative', overflow: 'hidden' }}>
      {typeKey === 'new-build' && (
        <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice"
             style={{ width: '100%', height: '100%', display: 'block' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={d}/>
              <stop offset="1" stopColor={a}/>
            </linearGradient>
          </defs>
          <rect width="600" height="400" fill={`url(#${gradId})`}/>
          <rect x="60"  y="160" width="220" height="240" fill={b} opacity=".95"/>
          <rect x="280" y="120" width="200" height="280" fill={c}/>
          <rect x="450" y="200" width="120" height="200" fill={b} opacity=".7"/>
          <g fill={d} opacity=".55">
            <rect x="100" y="200" width="20" height="40"/>
            <rect x="140" y="200" width="20" height="40"/>
            <rect x="180" y="200" width="20" height="40"/>
            <rect x="220" y="200" width="20" height="40"/>
            <rect x="100" y="280" width="20" height="40"/>
            <rect x="140" y="280" width="20" height="40"/>
            <rect x="180" y="280" width="20" height="40"/>
            <rect x="220" y="280" width="20" height="40"/>
            <rect x="310" y="160" width="40" height="80"/>
            <rect x="370" y="160" width="40" height="80"/>
            <rect x="430" y="160" width="40" height="80"/>
          </g>
          <rect x="0" y="380" width="600" height="20" fill={c} opacity=".4"/>
          <circle cx="80" cy="320" r="38" fill={c} opacity=".8"/>
          <rect x="76" y="315" width="6" height="60" fill={c}/>
          <circle cx="500" cy="100" r="34" fill={accent} opacity=".9"/>
        </svg>
      )}

      {typeKey === 'reno' && (
        <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice"
             style={{ width: '100%', height: '100%', display: 'block' }}>
          <rect width="600" height="400" fill={d}/>
          <rect x="0" y="0"   width="600" height="280" fill={a}/>
          <rect x="0" y="280" width="600" height="120" fill={b} opacity=".9"/>
          <path d="M120 60 h 80 a40 40 0 0 1 40 40 v160 h-160 v-160 a40 40 0 0 1 40-40z" fill={d} opacity=".55"/>
          <line x1="200" y1="60" x2="200" y2="260" stroke={c} strokeWidth="2"/>
          <line x1="120" y1="160" x2="280" y2="160" stroke={c} strokeWidth="2"/>
          <rect x="320" y="220" width="200" height="60" fill={c} rx="8"/>
          <rect x="320" y="200" width="40"  height="40" fill={c} rx="6"/>
          <rect x="480" y="200" width="40"  height="40" fill={c} rx="6"/>
          <rect x="340" y="180" width="160" height="50" fill={accent} opacity=".85" rx="6"/>
          <rect x="360" y="300" width="120" height="14" fill={c} opacity=".7" rx="3"/>
          <rect x="368" y="314" width="6"   height="30" fill={c} opacity=".5"/>
          <rect x="466" y="314" width="6"   height="30" fill={c} opacity=".5"/>
          <line x1="420" y1="0"  x2="420" y2="100" stroke={c} strokeWidth="1.5"/>
          <ellipse cx="420" cy="110" rx="22" ry="14" fill={c}/>
        </svg>
      )}

      {typeKey === 'commercial' && (
        <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice"
             style={{ width: '100%', height: '100%', display: 'block' }}>
          <rect width="600" height="400" fill={b}/>
          <path d="M0 80 Q150 60 300 100 T600 90 V0 H0 Z" fill={c}/>
          <path d="M0 200 Q200 180 400 220 T600 200 V120 Q400 100 200 130 T0 130 Z" fill={a} opacity=".7"/>
          <path d="M0 320 Q200 300 400 340 T600 320 V240 Q400 220 200 250 T0 250 Z" fill={d} opacity=".4"/>
          <rect x="160" y="260" width="280" height="80" fill={c} rx="6"/>
          <rect x="160" y="260" width="280" height="14" fill={a} opacity=".7" rx="6"/>
          {[230, 300, 370].map(x => (
            <g key={x}>
              <line x1={x} y1="120" x2={x} y2="200" stroke={accent} strokeWidth="1.2"/>
              <circle cx={x} cy="206" r="10" fill={accent}/>
            </g>
          ))}
          <rect x="60" y="60" width="80" height="80" fill={a} opacity=".85"/>
          <text x="100" y="108" textAnchor="middle" fill={d}
                fontFamily="serif" fontSize="36" fontStyle="italic">B</text>
        </svg>
      )}

      {typeKey === 'staging' && (
        <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice"
             style={{ width: '100%', height: '100%', display: 'block' }}>
          <rect width="600" height="400" fill={a}/>
          <rect x="0" y="0"   width="600" height="240" fill={d}/>
          <rect x="0" y="240" width="600" height="160" fill={b} opacity=".7"/>
          <rect x="180" y="240" width="240" height="100" fill="#FFFFFF" opacity=".85" rx="4"/>
          <rect x="180" y="226" width="240" height="22"  fill={c} rx="3"/>
          <rect x="200" y="248" width="80"  height="22"  fill={d} rx="4"/>
          <rect x="320" y="248" width="80"  height="22"  fill={d} rx="4"/>
          <rect x="120" y="280" width="50"  height="60"  fill={c} opacity=".7" rx="3"/>
          <rect x="430" y="280" width="50"  height="60"  fill={c} opacity=".7" rx="3"/>
          <rect x="138" y="240" width="14"  height="40"  fill={accent} opacity=".7"/>
          <rect x="448" y="240" width="14"  height="40"  fill={accent} opacity=".7"/>
          <rect x="260" y="60"  width="80"  height="100" fill={c} opacity=".7" rx="3"/>
          <rect x="270" y="70"  width="60"  height="80"  fill={accent} opacity=".5"/>
          <ellipse cx="510" cy="280" rx="22" ry="40" fill={c} opacity=".8"/>
          <rect x="500" y="320" width="20" height="20" fill={c} opacity=".6"/>
        </svg>
      )}
    </div>
  )
}
