'use client'

import { useEffect, useState, type KeyboardEvent } from 'react'
import { Button } from '@speclyy/design-system'
import { ArrowRight, Sparkle } from '@speclyy/design-system/icons'
import { NPIcon, NP_ICON_PATHS } from './icons'
import { PINTEREST_PALETTE, PINTEREST_PINS } from './data'

// Speclyy wordmark used inside the receiving panel.
function SpeclyyMark({ size = 16 }: { size?: number }) {
  return (
    <span style={{
      fontFamily: 'var(--font-display)',
      fontSize: size, fontWeight: 400,
      color: 'var(--fg-1)', letterSpacing: '-0.01em',
      fontVariationSettings: '"opsz" 72, "SOFT" 30',
      display: 'inline-flex', alignItems: 'baseline',
    }}>
      <span style={{ fontStyle: 'italic' }}>spec</span>
      <span>lyy</span>
      <span style={{ color: 'var(--accent)', marginLeft: 1 }}>✦</span>
    </span>
  )
}

interface PinterestCardProps {
  onPullComplete: (board: { label: string; thumbs: string[]; palette: string[] }) => void
}

export function PinterestCard({ onPullComplete }: PinterestCardProps) {
  const [val, setVal] = useState('')
  const [pulling, setPulling] = useState<string | null>(null)

  const submit = () => {
    const trimmed = val.trim()
    if (trimmed) setPulling(trimmed)
  }

  return (
    <>
      {pulling && (
        <PinterestPullOverlay
          url={pulling}
          onDone={() => {
            onPullComplete({
              label: pulling,
              thumbs: PINTEREST_PINS.map(p => p.img).slice(0, 9),
              palette: [...PINTEREST_PALETTE],
            })
            setPulling(null)
            setVal('')
          }}
        />
      )}

      <div style={{
        padding: '32px 32px 28px', borderRadius: 18, marginBottom: 16,
        background: 'linear-gradient(160deg, #FFF7F4, var(--bg-surface) 70%)',
        border: '1.5px solid var(--terracotta-100)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 18 }}>
          <PinterestMark size={56} fontSize={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400,
              lineHeight: 1.15,
              fontVariationSettings: '"opsz" 96, "SOFT" 40',
              paddingBottom: 4,
            }}>
              Paste your <span style={{ fontStyle: 'italic' }}>Pinterest</span> board
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 2 }}>
              Public board or secret link — we&rsquo;ll pull pins, palette, and finish cues automatically.
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 6px 6px 18px',
          background: 'var(--bg-surface)', border: '1.5px solid var(--border-2)',
          borderRadius: 14,
          transition: 'border-color var(--dur-base)',
        }}>
          <NPIcon d={NP_ICON_PATHS.link} size={17} style={{ color: 'var(--fg-3)' }} />
          <input
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') submit() }}
            placeholder="pinterest.com/yourname/atherton-kitchen/"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 15, fontFamily: 'var(--font-body)', color: 'var(--fg-1)',
              padding: '14px 0', minWidth: 0,
            }}
          />
          <Button
            variant="dark" size="md"
            onClick={submit}
            disabled={!val.trim()}
            style={{ opacity: val.trim() ? 1 : 0.5 }}
          >Pull board <ArrowRight size={14} /></Button>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
          fontSize: 12, color: 'var(--fg-3)',
        }}>
          <Sparkle size={12} strokeWidth={2} />
          Typically pulls 30–80 pins · ready in seconds
        </div>
      </div>
    </>
  )
}

export function PinterestMark({ size = 56, fontSize = 30 }: { size?: number; fontSize?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0,
      background: '#E60023', color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize,
      fontStyle: 'italic',
      boxShadow: '0 4px 12px rgba(230,0,35,.25)',
    }}>P</div>
  )
}

// --- 4-second Pinterest pull overlay -----------------------------------------
//
// Phase 0 (0–600ms):    Connecting — bridges shown, no pins fly yet.
// Phase 1 (600–3200ms): Pulling — pins fly from the Pinterest panel into the
//                        Speclyy panel; 12 pins spaced ~200ms apart.
// Phase 2 (3200–3800ms): Palette extracted — 5-stop strip fades in.
// Phase 3 (3800–4200ms): Done — overlay holds, then closes.

interface PinterestPullOverlayProps {
  url: string
  onDone: () => void
}

function PinterestPullOverlay({ url, onDone }: PinterestPullOverlayProps) {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0)
  const [pinsLanded, setPinsLanded] = useState(0)
  const TOTAL_PINS = 12

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600)
    const t2 = setTimeout(() => setPhase(2), 3200)
    const t3 = setTimeout(() => setPhase(3), 3800)
    const t4 = setTimeout(() => onDone(), 4200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (phase !== 1) return
    const id = setInterval(() => setPinsLanded(p => Math.min(p + 1, TOTAL_PINS)), 200)
    return () => clearInterval(id)
  }, [phase])

  const titles = [
    'Connecting to Pinterest…',
    'Pulling pins from your board…',
    'Extracting palette & finishes…',
    'Board is in.',
  ]

  const progressPct =
    phase === 3 ? 100 :
    phase === 2 ? 88 :
    phase === 1 ? 10 + (pinsLanded / TOTAL_PINS) * 70 :
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
        width: 920, maxWidth: '94vw', height: 520,
        background: 'var(--bg-surface)', borderRadius: 22,
        boxShadow: '0 32px 80px rgba(0,0,0,.4)', overflow: 'hidden',
        display: 'grid', gridTemplateRows: 'auto 1fr auto',
      }}>
        <div style={{ padding: '22px 28px 14px', borderBottom: '1px solid var(--border-1)' }}>
          <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 6 }}>
            Setting up your board
          </div>
          <h2 style={{
            margin: 0, fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 400,
            lineHeight: 1.15, fontVariationSettings: '"opsz" 144, "SOFT" 50',
          }}>{titles[phase]}</h2>
        </div>

        <div style={{
          position: 'relative', display: 'grid',
          gridTemplateColumns: '1fr 80px 1fr', overflow: 'hidden',
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #F8F6F3, #EDE7DD)',
            padding: '18px 16px', position: 'relative',
            borderRight: '1px solid var(--border-1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <PinterestMark size={24} fontSize={14} />
              <div style={{
                fontSize: 12, color: 'var(--fg-3)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{url}</div>
            </div>
            <div style={{ columns: 3, columnGap: 6 }}>
              {PINTEREST_PINS.map((p, i) => {
                const flying = phase >= 1 && i < pinsLanded
                return (
                  <div key={i} style={{
                    breakInside: 'avoid', marginBottom: 6, borderRadius: 6,
                    height: p.h,
                    backgroundImage: `url(${p.img})`,
                    backgroundColor: p.c,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: flying ? 0.25 : 1,
                    transition: 'opacity 400ms',
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.04)',
                  }} />
                )
              })}
            </div>
          </div>

          <div style={{ position: 'relative', background: 'var(--paper-100)' }}>
            {phase >= 1 && Array.from({ length: pinsLanded }).map((_, i) => {
              const pin = PINTEREST_PINS[i]
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: -40, top: 60 + (i % 6) * 50,
                    width: 36, height: 36, borderRadius: 6,
                    backgroundImage: `url(${pin.img})`,
                    backgroundColor: pin.c,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    boxShadow: '0 6px 14px rgba(0,0,0,.3)',
                    ['--pin-tx' as never]: '160px',
                    ['--pin-ty' as never]: `${(i % 4) * 20}px`,
                    animation: 'speclyy-pin-fly 1100ms var(--ease-out) forwards',
                  } as React.CSSProperties}
                />
              )
            })}
          </div>

          <div style={{
            background: 'var(--bg-surface)', padding: '18px 16px',
            borderLeft: '1px solid var(--border-1)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SpeclyyMark size={16} />
              <div style={{ fontSize: 12, color: 'var(--fg-2)', fontWeight: 600 }}>
                Project moodboard
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-3)' }}>
                {pinsLanded}/{TOTAL_PINS}
              </span>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, flex: 1,
            }}>
              {PINTEREST_PINS.map((p, i) => {
                const landed = i < pinsLanded
                return (
                  <div
                    key={i}
                    style={{
                      height: 56, borderRadius: 6,
                      backgroundImage: landed ? `url(${p.img})` : 'none',
                      backgroundColor: landed ? p.c : 'var(--paper-100)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      border: landed ? '1px solid rgba(0,0,0,.06)' : '1px dashed var(--border-3)',
                      animation: landed ? 'speclyy-pin-land 360ms var(--ease-out) both' : 'none',
                      animationDelay: landed ? '900ms' : '0ms',
                    }}
                  />
                )
              })}
            </div>

            {phase >= 2 && (
              <div style={{ animation: 'speclyy-fade-in 360ms' }}>
                <div className="eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>
                  Palette extracted
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {PINTEREST_PALETTE.map(c => (
                    <div key={c} style={{
                      flex: 1, height: 22, borderRadius: 4, background: c,
                      border: '1px solid rgba(0,0,0,.06)',
                    }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '14px 28px 18px' }}>
          <div style={{ height: 4, background: 'var(--paper-200)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: 'var(--accent)', borderRadius: 999,
              width: `${progressPct}%`,
              transition: 'width 300ms var(--ease-out)',
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}
