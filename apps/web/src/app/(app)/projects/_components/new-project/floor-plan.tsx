'use client'

import { useEffect, useState } from 'react'
import { Button } from '@speclyy/design-system'
import { Check, X as XIcon } from '@speclyy/design-system/icons'
import { NPIcon, NP_ICON_PATHS } from './icons'
import { PARSED_CUSTOM, PARSED_RENAMES, PARSED_STANDARD } from './data'
import type { NPData } from './types'

interface FloorPlanProps {
  data: NPData
  onChange: (patch: Partial<NPData>) => void
}

export function FloorPlan({ data, onChange }: FloorPlanProps) {
  const [parsing, setParsing] = useState(false)
  const dropped = !!data.floorPlanName

  return (
    <>
      {parsing && (
        <ParsingOverlay onDone={patch => { setParsing(false); onChange(patch) }} />
      )}
      <div style={{
        padding: '20px 22px', borderRadius: 14, marginBottom: 22,
        background: dropped ? 'var(--sage-50)' : 'var(--paper-100)',
        border: `1px dashed ${dropped ? 'var(--sage-500)' : 'var(--border-3)'}`,
        display: 'flex', alignItems: 'center', gap: 16,
        transition: 'all var(--dur-base)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 12, flexShrink: 0,
          background: 'var(--bg-surface)', border: '1px solid var(--border-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: dropped ? 'var(--sage-500)' : 'var(--accent)',
        }}>
          {dropped
            ? <Check size={22} strokeWidth={2.4} />
            : <NPIcon d={NP_ICON_PATHS.upload} size={22} sw={1.8} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400 }}>
            {dropped ? data.floorPlanName : 'Drop a floor plan or PDF (optional)'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>
            {dropped
              ? 'We detected rooms automatically and matched their names — adjust below if needed.'
              : "If you have one, we'll detect rooms, name them just like your plan, and add bespoke spaces too."}
          </div>
        </div>
        {dropped ? (
          <Button
            variant="ghost" size="sm"
            onClick={() => onChange({
              floorPlanName: null, rooms: [], customRooms: [], renames: {},
            })}
          ><XIcon size={14} /> Remove</Button>
        ) : (
          <Button
            variant="ghost" size="sm"
            onClick={() => setParsing(true)}
          ><NPIcon d={NP_ICON_PATHS.upload} size={14} /> Browse</Button>
        )}
      </div>
    </>
  )
}

// --- 6-second parsing overlay -------------------------------------------------
//
// Phase 0 (0–800ms):    "Reading plan" — scan beam crosses the canvas.
// Phase 1 (800–5400ms): "Detecting rooms" — labels pop in one by one as the
//                        scan continues; standard rooms tagged COMPLETE, custom
//                        rooms tagged BESPOKE. Some standard rooms get renamed
//                        per PARSED_RENAMES.
// Phase 2 (5400ms+):    "Done" — full plan visible; we wait 600ms before
//                        emitting the resolved data shape and closing.

interface ParsedResult {
  floorPlanName: string
  rooms: string[]
  customRooms: string[]
  renames: Record<string, string>
}

interface ParsingOverlayProps {
  onDone: (result: ParsedResult) => void
}

function ParsingOverlay({ onDone }: ParsingOverlayProps) {
  const [phase, setPhase] = useState<0 | 1 | 2>(0)
  const [detectedIdx, setDetectedIdx] = useState(0)
  const allDetected = [...PARSED_STANDARD, ...PARSED_CUSTOM]

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800)
    const t2 = setTimeout(() => setPhase(2), 5400)
    const t3 = setTimeout(() => onDone({
      floorPlanName: 'Atherton-A100-floor-plan.pdf',
      rooms: [...allDetected],
      customRooms: [...PARSED_CUSTOM],
      renames: { ...PARSED_RENAMES },
    }), 6000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (phase !== 1) return
    const id = setInterval(() => {
      setDetectedIdx(i => Math.min(i + 1, allDetected.length))
    }, 4400 / allDetected.length)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const progressPct =
    phase === 2 ? 100 :
    phase === 1 ? (detectedIdx / allDetected.length) * 90 + 10 :
    8

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(36, 26, 18, .55)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'speclyy-fade-in 200ms',
    }}>
      <div style={{
        width: 880, maxWidth: '92vw',
        background: 'var(--bg-surface)', borderRadius: 22,
        boxShadow: '0 32px 80px rgba(0,0,0,.4)',
        overflow: 'hidden',
        display: 'grid', gridTemplateColumns: '1.1fr 1fr',
      }}>
        <div style={{
          position: 'relative',
          background: 'linear-gradient(160deg, #1F1A12 0%, #3F352B 100%)',
          padding: 32, minHeight: 480,
          overflow: 'hidden',
        }}>
          <FloorPlanScan phase={phase} detectedIdx={detectedIdx} />
          {phase === 1 && (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: 0,
              height: 4,
              background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
              animation: 'speclyy-scan 2200ms linear infinite',
              boxShadow: '0 0 24px var(--accent)',
            }} />
          )}
        </div>

        <div style={{
          padding: '36px 32px',
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <div className="eyebrow" style={{ color: 'var(--accent)' }}>
            {phase === 0 ? 'Reading plan' : phase === 1 ? 'Detecting rooms' : 'Done'}
          </div>
          <h2 style={{
            margin: 0, fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400,
            lineHeight: 1.15, fontVariationSettings: '"opsz" 144, "SOFT" 50',
            paddingBottom: 4,
          }}>
            {phase === 0 && <>Parsing your <span style={{ fontStyle: 'italic' }}>floor plan</span>…</>}
            {phase === 1 && <>Doing a little <span style={{ fontStyle: 'italic' }}>magic</span>.</>}
            {phase === 2 && <>Found <span style={{ fontStyle: 'italic' }}>{allDetected.length} rooms</span>.</>}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5 }}>
            {phase === 0 && 'Locating walls, labels, and any custom spaces…'}
            {phase === 1 && 'Auto-selecting standard rooms and naming them just like your plan does. Bespoke rooms (wet bar, wine cellar, etc.) are added too.'}
            {phase === 2 && "You'll land back on the room picker with everything pre-selected."}
          </p>

          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', gap: 4,
            overflow: 'hidden',
          }}>
            {allDetected.slice(0, detectedIdx).map(r => {
              const isCustom = PARSED_CUSTOM.includes(r)
              const renamed = PARSED_RENAMES[r]
              return (
                <div key={r} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 8,
                  background: isCustom ? 'var(--terracotta-50)' : 'var(--paper-100)',
                  border: `1px solid ${isCustom ? 'var(--terracotta-100)' : 'var(--border-1)'}`,
                  fontSize: 12, color: 'var(--fg-2)',
                  animation: 'speclyy-summary-in 280ms var(--ease-out)',
                }}>
                  <Check
                    size={11} strokeWidth={2.6}
                    style={{ color: isCustom ? 'var(--accent)' : 'var(--sage-500)' }}
                  />
                  <span style={{ flex: 1 }}>
                    {renamed ?? r}
                    {renamed && (
                      <span style={{ color: 'var(--fg-4)', marginLeft: 6, fontSize: 10 }}>
                        renamed from &ldquo;{r}&rdquo;
                      </span>
                    )}
                  </span>
                  {isCustom && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                      padding: '2px 6px', borderRadius: 4,
                      background: 'var(--accent)', color: 'var(--paper-50)',
                    }}>BESPOKE</span>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{
            height: 4, background: 'var(--paper-200)', borderRadius: 999, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', background: 'var(--accent)', borderRadius: 999,
              width: `${progressPct}%`,
              transition: 'width 400ms var(--ease-out)',
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Stylized SVG floor plan — walls draw in, room labels pop one by one as
// `detectedIdx` advances. The grid is a fixed hand-laid 12-room layout.
function FloorPlanScan({ phase, detectedIdx }: { phase: 0 | 1 | 2; detectedIdx: number }) {
  const rooms = [
    { x: 20,  y: 20,  w: 160, h: 90,  label: 'Foyer' },
    { x: 180, y: 20,  w: 200, h: 130, label: 'Kitchen' },
    { x: 380, y: 20,  w: 180, h: 130, label: 'Master bedroom' },
    { x: 20,  y: 110, w: 160, h: 100, label: 'Living room' },
    { x: 180, y: 150, w: 120, h: 100, label: 'Dining' },
    { x: 300, y: 150, w: 80,  h: 100, label: 'Powder' },
    { x: 380, y: 150, w: 100, h: 100, label: 'Master bath' },
    { x: 480, y: 150, w: 80,  h: 100, label: 'Laundry' },
    { x: 20,  y: 210, w: 160, h: 100, label: 'Office' },
    { x: 180, y: 250, w: 200, h: 60,  label: 'Lounge' },
    { x: 380, y: 250, w: 100, h: 60,  label: 'Wet bar' },
    { x: 480, y: 250, w: 80,  h: 60,  label: 'Wine cellar' },
  ]

  return (
    <svg viewBox="0 0 600 360" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="plan-floor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5C4B38" stopOpacity=".4" />
          <stop offset="1" stopColor="#A89884" stopOpacity=".15" />
        </linearGradient>
      </defs>
      <g transform="matrix(1, 0, -.18, 1, 60, 10)">
        <rect
          x="10" y="10" width="560" height="310" rx="6"
          fill="url(#plan-floor)" stroke="#A89884" strokeWidth=".5" strokeOpacity=".4"
        />
        {rooms.map((r, i) => {
          const detected = phase >= 1 && i < detectedIdx
          return (
            <g key={i}>
              <rect
                x={r.x} y={r.y} width={r.w} height={r.h}
                fill={detected ? 'rgba(192, 107, 62, .25)' : 'rgba(168, 152, 132, .08)'}
                stroke={detected ? '#C06B3E' : '#A89884'}
                strokeWidth={detected ? 1.5 : 0.8}
                strokeOpacity={detected ? 1 : 0.5}
                style={{ transition: 'all 400ms var(--ease-out)' }}
              />
              {detected && (
                <text
                  x={r.x + r.w / 2} y={r.y + r.h / 2 + 3}
                  textAnchor="middle" fontSize={9}
                  fontFamily="var(--font-mono)"
                  fill="#F0EBE0" fontWeight={600}
                  style={{ animation: 'speclyy-fade-in 300ms var(--ease-out)' }}
                >
                  {r.label.toUpperCase()}
                </text>
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}
