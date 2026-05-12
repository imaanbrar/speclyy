'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@speclyy/design-system'
import { ArrowRight, Check, Sparkle } from '@speclyy/design-system/icons'
import { Glyph } from './icons'
import { ItemImage } from './item-image'
import {
  NP_CAT_PRODUCTS,
  NP_GLYPHS,
  NP_FALLBACK_THUMBS,
  npRoomGlyph,
  npSamplesFor,
  unsplash,
  type ProductSpec,
} from './data'
import type { NPData, NPProjectType } from './types'

interface CreatingProps {
  data: NPData
  type: NPProjectType
  onOpen: () => void
}

// 10-second magic-moment screen. A single rAF loop drives `progress` from
// 0 → 1; each scene reads the value and decides what's visible/flying.
//
// Three flavors:
//   - residential: 3 acts (rooms → categories → moodboard) crossfade
//   - staging/decor: room composition with furniture drifting in
//   - commercial: concept board with tiles + zones list
export function Creating({ data, type, onOpen }: CreatingProps) {
  const TOTAL_MS = 10000
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    let raf: number
    const tick = (t: number) => {
      if (startRef.current == null) startRef.current = t
      const elapsed = t - startRef.current
      const p = Math.min(1, elapsed / TOTAL_MS)
      setProgress(p)
      if (p < 1) raf = requestAnimationFrame(tick)
      else setDone(true)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const displayLabel = data.type === 'other' && data.customLabel ? data.customLabel : type.label
  const flavor: 'residential' | 'staging' | 'commercial' =
    type.id === 'staging' || type.id === 'decor' ? 'staging' :
    type.id === 'commercial' ? 'commercial' : 'residential'

  const stages =
    flavor === 'staging' ? [
      'Composing your rooms…',
      'Pairing furniture & accessories…',
      'Building your moodboard…',
      'Almost there…',
    ] :
    flavor === 'commercial' ? [
      'Mapping your zones…',
      'Sourcing FFE & finishes…',
      'Building your concept board…',
      'Almost there…',
    ] : [
      'Setting up your rooms…',
      'Sorting items into categories…',
      'Adding lead-time hints…',
      'Building your moodboard…',
    ]
  const stageIdx = Math.min(stages.length - 1, Math.floor(progress * stages.length))
  const subtitle = done
    ? "Ready to start spec'ing — open the project to add pieces."
    : stages[stageIdx]

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      padding: '40px 40px 32px', gap: 22, overflow: 'hidden',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto', flexShrink: 0 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20, margin: '0 auto 18px',
          background: 'linear-gradient(160deg, var(--terracotta-50), var(--bg-surface))',
          border: '1px solid var(--terracotta-100)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: done ? 'var(--sage-500)' : 'var(--accent)',
          animation: done ? 'none' : 'speclyy-pulse 1800ms infinite',
        }}>
          {done ? <Check size={28} strokeWidth={2.4} /> : <Sparkle size={28} />}
        </div>
        <h2 style={{
          margin: 0, fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 400,
          fontVariationSettings: '"opsz" 144, "SOFT" 50', letterSpacing: '-0.01em',
        }}>
          {done
            ? <><span style={{ fontStyle: 'italic' }}>{data.name || displayLabel}</span> is ready.</>
            : subtitle}
        </h2>
        <p style={{ margin: '8px 0 0', color: 'var(--fg-3)', fontSize: 14 }}>
          {done ? subtitle : 'Crafting your project — sit tight, this takes about 10 seconds.'}
        </p>
      </div>

      <div style={{
        flex: 1, minHeight: 0, position: 'relative',
        maxWidth: 1100, width: '100%', margin: '0 auto',
      }}>
        {flavor === 'residential' && <SceneResidential data={data} type={type} progress={progress} />}
        {flavor === 'staging' && <SceneStaging progress={progress} />}
        {flavor === 'commercial' && <SceneCommercial data={data} progress={progress} />}
      </div>

      <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', flexShrink: 0 }}>
        <div style={{ height: 4, background: 'var(--paper-200)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: 'var(--accent)', borderRadius: 999,
            width: `${progress * 100}%`,
            transition: 'width 60ms linear',
          }} />
        </div>
        {done && (
          <div style={{
            display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18,
            animation: 'speclyy-fade-in 400ms ease',
          }}>
            <Button variant="ghost" size="md">Add team</Button>
            <Button variant="dark" size="md" onClick={onOpen}>
              Open project <ArrowRight size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Residential — 3-act crossfade ------------------------------------------
function SceneResidential({
  data, type, progress,
}: {
  data: NPData
  type: NPProjectType
  progress: number
}) {
  const allCats = type.auto.length ? type.auto : [
    'Plumbing', 'Lighting', 'Tile', 'Hardware', 'Appliances', 'Paint',
  ]
  const groups = allCats.slice(0, 6)
  const userRooms = (data.rooms.length ? data.rooms : type.defaultRooms ?? [
    'Kitchen', 'Living room', 'Primary suite', 'Primary bath',
  ]).slice(0, 8)
  const palette: readonly string[] = [...type.palette, '#3F352B', '#E8DFCE']

  const act = progress < 0.35 ? 0 : progress < 0.75 ? 1 : 2
  const actLabels = ['Rooms', 'Categories', 'Moodboard']

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 360 }}>
      <div style={{
        position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 8, zIndex: 20,
      }}>
        {actLabels.map((l, i) => (
          <div key={l} style={{
            padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            background: act === i ? 'var(--accent)' : i < act ? 'var(--sage-50)' : 'var(--paper-200)',
            color: act === i ? '#fff' : i < act ? 'var(--sage-500)' : 'var(--fg-3)',
            border: `1px solid ${act === i ? 'var(--accent)' : i < act ? 'var(--sage-500)' : 'var(--border-2)'}`,
            transition: 'all 320ms var(--ease-out)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {i < act && <Check size={11} strokeWidth={2.6} />}
            {l}
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', inset: 0, paddingTop: 36 }}>
        <ActLayer visible={act === 0}>
          <ActRooms rooms={userRooms} progress={progress / 0.35} />
        </ActLayer>
        <ActLayer visible={act === 1}>
          <ActCategories groups={groups} progress={Math.max(0, (progress - 0.35) / 0.4)} />
        </ActLayer>
        <ActLayer visible={act === 2}>
          <ActMoodboard palette={palette} groups={groups} progress={Math.max(0, (progress - 0.75) / 0.25)} />
        </ActLayer>
      </div>
    </div>
  )
}

function ActLayer({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute', inset: 36,
      opacity: visible ? 1 : 0,
      transition: 'opacity 400ms var(--ease-out)',
      pointerEvents: 'none',
    }}>{children}</div>
  )
}

function ActRooms({ rooms, progress }: { rooms: string[]; progress: number }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.min(4, rooms.length)}, 1fr)`,
      gap: 14, height: '100%', alignContent: 'center',
    }}>
      {rooms.map((r, i) => {
        const t = (i + 1) / rooms.length
        const settled = progress >= t * 0.9
        const flying = progress >= t * 0.9 - 0.12 && progress < t * 0.9
        const flyP = flying ? Math.min(1, (progress - (t * 0.9 - 0.12)) / 0.12) : settled ? 1 : 0
        if (!settled && !flying) return null
        return (
          <div key={r + i} style={{
            background: 'var(--bg-surface)', border: '1.5px solid var(--border-2)',
            borderRadius: 14, padding: '20px 16px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            transform: `translateY(${(1 - flyP) * 30}px) scale(${0.85 + 0.15 * flyP})`,
            opacity: flyP,
            boxShadow: settled ? 'var(--shadow-xs)' : '0 12px 30px rgba(0,0,0,.18)',
            transition: 'box-shadow 240ms',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'linear-gradient(160deg, var(--terracotta-50), var(--bg-surface))',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent)',
              border: '1px solid var(--terracotta-100)',
            }}>
              <Glyph d={NP_GLYPHS[npRoomGlyph(r)]} size={32} sw={1.5} />
            </div>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: 'var(--fg-1)', textAlign: 'center',
            }}>{r}</div>
          </div>
        )
      })}
    </div>
  )
}

interface CategoryArrival {
  group: string
  slot: number
  t: number
}

function ActCategories({ groups, progress }: { groups: string[]; progress: number }) {
  const arrivals = useMemo<CategoryArrival[]>(() => {
    const arr: CategoryArrival[] = []
    let i = 0
    const total = groups.length * 4
    for (let slot = 0; slot < 4; slot++) {
      for (let g = 0; g < groups.length; g++) {
        const t = i / Math.max(1, total - 1)
        arr.push({ group: groups[g], slot, t })
        i++
      }
    }
    return arr
  }, [groups])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)',
        gap: 14,
      }}>
        {groups.map(g => {
          const groupArrivals = arrivals.filter(a => a.group === g)
          const filled = groupArrivals.filter(a => progress >= a.t).length
          const ready = filled === groupArrivals.length
          const products: ReadonlyArray<ProductSpec> = NP_CAT_PRODUCTS[g] ?? [
            { id: 'paint-1', hex: '#A89884' },
            { id: 'paint-2', hex: '#C7B8A1' },
            { id: 'paint-1', hex: '#3F352B' },
            { id: 'paint-4', hex: '#E8DFCE' },
          ]
          return (
            <div key={g} style={{
              border: `1.5px dashed ${ready ? 'var(--sage-500)' : filled > 0 ? 'var(--accent)' : 'var(--border-3)'}`,
              borderRadius: 14,
              background: ready ? 'var(--sage-50)' : filled > 0 ? '#FFF7F4' : 'var(--paper-100)',
              padding: '12px 14px 10px',
              transition: 'all 300ms var(--ease-out)',
              display: 'flex', flexDirection: 'column',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 8,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-1)' }}>{g}</div>
                <div style={{
                  fontSize: 10,
                  color: ready ? 'var(--sage-500)' : 'var(--fg-3)',
                  fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  {ready && <Check size={11} strokeWidth={2.6} />}
                  {filled}/{groupArrivals.length}
                </div>
              </div>
              <div style={{
                flex: 1, display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)',
                gap: 6,
              }}>
                {[0, 1, 2, 3].map(s => {
                  const arrival = groupArrivals.find(a => a.slot === s)
                  const settled = !!arrival && progress >= arrival.t
                  const flying = !!arrival && progress >= arrival.t - 0.06 && progress < arrival.t
                  const flyP = flying ? Math.min(1, (progress - (arrival!.t - 0.06)) / 0.06) : settled ? 1 : 0
                  const product = products[s]
                  return (
                    <div key={s} style={{
                      borderRadius: 8, overflow: 'hidden',
                      background: settled ? 'var(--bg-surface)' : 'rgba(0,0,0,.04)',
                      border: `1px ${settled ? 'solid var(--border-2)' : 'dashed rgba(0,0,0,.06)'}`,
                      display: 'flex', alignItems: 'stretch', justifyContent: 'center',
                      transform: settled || flying
                        ? `translateY(${(1 - flyP) * -40}px) rotate(${(1 - flyP) * (s % 2 ? -10 : 10)}deg) scale(${0.7 + 0.3 * flyP})`
                        : 'none',
                      opacity: settled || flying ? flyP : 0.2,
                      transition: settled ? 'transform 200ms var(--ease-out), background 200ms' : 'none',
                      boxShadow: flying ? '0 8px 18px rgba(0,0,0,.16)' : 'none',
                    }}>
                      {(settled || flying) && product && (
                        <div style={{ width: '100%', height: '100%' }}>
                          <ItemImage id={product.id} finishHex={product.hex} size="100%" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type MoodItem =
  | { kind: 'swatch'; c: string; t: number }
  | { kind: 'hero'; label: string; product: ProductSpec; t: number }
  | { kind: 'note'; t: number }

function ActMoodboard({
  palette, groups, progress,
}: {
  palette: readonly string[]
  groups: string[]
  progress: number
}) {
  const heroCats = groups.slice(0, 2)
  const items: MoodItem[] = [
    ...palette.slice(0, 5).map((c, i): MoodItem => ({ kind: 'swatch', c, t: 0.05 + i * 0.1 })),
    ...heroCats.map((g, i): MoodItem => ({
      kind: 'hero', label: g,
      product: NP_CAT_PRODUCTS[g]?.[0] ?? { id: 'paint-1', hex: '#A89884' },
      t: 0.55 + i * 0.18,
    })),
    { kind: 'note', t: 0.9 },
  ]

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--bg-surface)', border: '1px solid var(--border-2)', borderRadius: 16,
      padding: 24, position: 'relative', overflow: 'hidden',
      display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', gap: 10,
    }}>
      {items.map((it, i) => {
        const settled = progress >= it.t
        const flying = progress >= it.t - 0.08 && progress < it.t
        const flyP = flying ? Math.min(1, (progress - (it.t - 0.08)) / 0.08) : settled ? 1 : 0
        if (!settled && !flying) return null
        const common: React.CSSProperties = {
          opacity: flyP,
          transform: `translateY(${(1 - flyP) * 30}px) rotate(${(1 - flyP) * (i % 2 ? -6 : 6)}deg) scale(${0.85 + 0.15 * flyP})`,
          transition: settled ? 'transform 220ms' : 'none',
          boxShadow: flying ? '0 12px 28px rgba(0,0,0,.2)' : 'var(--shadow-xs)',
        }
        if (it.kind === 'swatch') {
          return (
            <div key={i} style={{
              ...common, background: it.c, borderRadius: 10,
              border: '1px solid rgba(0,0,0,.06)',
              gridColumn: 'span 1', gridRow: 'span 1',
            }} />
          )
        }
        if (it.kind === 'hero') {
          return (
            <div key={i} style={{
              ...common, gridColumn: 'span 2', gridRow: 'span 2',
              background: 'var(--paper-100)', border: '1px solid var(--border-2)', borderRadius: 12,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <ItemImage id={it.product.id} finishHex={it.product.hex} size="100%" />
              </div>
              <div style={{
                padding: '6px 10px', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)',
                borderTop: '1px solid var(--border-1)', background: 'var(--bg-surface)',
              }}>{it.label}</div>
            </div>
          )
        }
        return (
          <div key={i} style={{
            ...common, gridColumn: 'span 2', gridRow: 'span 1',
            background: '#fff', border: '1px solid var(--border-2)', borderRadius: 10,
            padding: '10px 12px', fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 14, color: 'var(--fg-2)',
            display: 'flex', alignItems: 'center',
          }}>&ldquo;Warm, layered, lived-in&rdquo;</div>
        )
      })}
    </div>
  )
}

// --- Staging / decor: room composition --------------------------------------
function SceneStaging({ progress }: { progress: number }) {
  const items = useMemo(() => {
    const slots = [
      { x: 30, y: 60, w: 120, h: 70, group: 'Furniture' },
      { x: 60, y: 35, w: 80,  h: 80, group: 'Art & accessories' },
      { x: 14, y: 35, w: 50,  h: 50, group: 'Lighting' },
      { x: 18, y: 78, w: 90,  h: 25, group: 'Rugs' },
      { x: 78, y: 62, w: 60,  h: 60, group: 'Furniture' },
      { x: 70, y: 78, w: 40,  h: 28, group: 'Rugs' },
      { x: 45, y: 18, w: 30,  h: 30, group: 'Art & accessories' },
      { x: 5,  y: 65, w: 40,  h: 50, group: 'Furniture' },
    ]
    return slots.map((s, idx) => {
      const samples = npSamplesFor(s.group)
      return {
        ...s,
        img: samples[idx % samples.length] ?? NP_FALLBACK_THUMBS[0],
        t: 0.08 + (idx / slots.length) * 0.78,
        idx,
      }
    })
  }, [])

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', minHeight: 360,
      display: 'flex', gap: 16, padding: '8px 0',
    }}>
      <div style={{
        flex: 1.6, position: 'relative',
        background: 'linear-gradient(180deg, #F5EFE3 0%, #E8DFCE 60%, #D4C5AE 100%)',
        borderRadius: 16, border: '1px solid var(--border-2)',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '60%',
          height: 1, background: 'rgba(0,0,0,.06)',
        }} />
        <div style={{
          position: 'absolute', right: '12%', top: '12%',
          width: 80, height: 90,
          border: '2px solid rgba(255,255,255,.7)', borderRadius: 4,
          background: 'rgba(255,255,255,.3)',
        }} />
        {items.map((it, i) => {
          const visStart = it.t - 0.06
          const settled = progress >= it.t
          const flying = progress >= visStart && progress < it.t
          const flyP = flying ? (progress - visStart) / 0.06 : settled ? 1 : 0
          const opacity = settled ? 1 : flying ? flyP : 0
          return (
            <div key={i} style={{
              position: 'absolute', left: `${it.x}%`, top: `${it.y}%`,
              width: it.w, height: it.h, borderRadius: 8, overflow: 'hidden',
              background: 'var(--paper-200)',
              boxShadow: settled ? '0 4px 12px rgba(0,0,0,.12)' : '0 12px 30px rgba(0,0,0,.22)',
              opacity,
              transform: `translateY(${(1 - flyP) * -180}px) scale(${0.92 + 0.08 * flyP})`,
              transition: settled ? 'box-shadow 200ms' : 'none',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={unsplash(it.img, 240)} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0' }}
              />
            </div>
          )
        })}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Adding to room</div>
        {items.map((it, i) => {
          const settled = progress >= it.t
          const flying = progress >= it.t - 0.06 && progress < it.t
          if (!settled && !flying) return null
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', background: 'var(--bg-surface)',
              border: '1px solid var(--border-1)', borderRadius: 10,
              animation: 'speclyy-fade-in 240ms var(--ease-out)',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 6, overflow: 'hidden',
                background: 'var(--paper-200)', flexShrink: 0,
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={unsplash(it.img, 64)} alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-1)' }}>{it.group}</div>
                <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>placed</div>
              </div>
              <Check size={13} strokeWidth={2.4} style={{ color: 'var(--sage-500)' }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Commercial: concept board ----------------------------------------------
function SceneCommercial({ data, progress }: { data: NPData; progress: number }) {
  const zones = (data.rooms.length ? data.rooms : ['Lobby', 'Workspace', 'Café', 'Meeting']).slice(0, 4)
  const tiles = useMemo(() => {
    const tileGroups = ['Lighting', 'FFE', 'Finishes', 'Casegoods', 'Signage']
    const COLS = 5
    const ROWS = 4
    const out: Array<{ c: number; r: number; group: string; img: string; t: number }> = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const g = tileGroups[(r + c) % tileGroups.length]
        const samples = npSamplesFor(g)
        const i = r * COLS + c
        out.push({
          c, r, group: g,
          img: samples[i % samples.length] ?? NP_FALLBACK_THUMBS[0],
          t: 0.05 + (i / (COLS * ROWS)) * 0.82,
        })
      }
    }
    return out
  }, [])

  return (
    <div style={{
      display: 'flex', gap: 18, width: '100%', height: '100%', minHeight: 360,
    }}>
      <div style={{
        flex: 2, background: '#1F1A12', borderRadius: 16, padding: 14,
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: 'repeat(4, 1fr)',
        gap: 6, position: 'relative', overflow: 'hidden',
      }}>
        {tiles.map((t, i) => {
          const settled = progress >= t.t
          const flying = progress >= t.t - 0.05 && progress < t.t
          const flyP = flying ? (progress - (t.t - 0.05)) / 0.05 : settled ? 1 : 0
          return (
            <div key={i} style={{
              borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,.04)',
              opacity: settled ? 1 : flying ? flyP : 0,
              transform: `scale(${0.6 + 0.4 * flyP})`,
              transition: settled ? 'transform 200ms' : 'none',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={unsplash(t.img, 240)} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0' }}
              />
            </div>
          )
        })}
        <div style={{
          position: 'absolute', left: 14, bottom: 14, color: '#fff',
          fontFamily: 'var(--font-display)', fontSize: 18,
          textShadow: '0 2px 8px rgba(0,0,0,.5)',
        }}>
          Concept board
          <div style={{
            fontSize: 10, opacity: 0.7,
            fontFamily: 'var(--font-body)', marginTop: 2,
          }}>{data.concept ?? 'building'}</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Zones</div>
        {zones.map((z, zi) => {
          const t = 0.1 + (zi / zones.length) * 0.7
          const settled = progress >= t
          if (!settled && progress < t - 0.05) return null
          return (
            <div key={z} style={{
              padding: '10px 12px', background: 'var(--bg-surface)',
              border: '1px solid var(--border-1)', borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 10,
              animation: 'speclyy-fade-in 240ms var(--ease-out)',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: 999,
                background: settled ? 'var(--sage-500)' : 'var(--accent)',
              }} />
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{z}</div>
              {settled && <Check size={13} strokeWidth={2.4} style={{ color: 'var(--sage-500)' }} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
