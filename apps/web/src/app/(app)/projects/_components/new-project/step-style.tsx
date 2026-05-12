'use client'

import { useState, type KeyboardEvent } from 'react'
import { Button } from '@speclyy/design-system'
import { Sparkle, X as XIcon } from '@speclyy/design-system/icons'
import { NPIcon, NP_ICON_PATHS } from './icons'
import { PinterestCard, PinterestMark } from './pinterest'
import type { NPData, NPStyleRef } from './types'

interface StyleStepProps {
  data: NPData
  onChange: (patch: Partial<NPData>) => void
}

export function StyleStep({ data, onChange }: StyleStepProps) {
  const refs = data.refs
  const hasPinterest = refs.some(r => r.kind === 'pinterest')

  const removeRef = (target: NPStyleRef) =>
    onChange({ refs: refs.filter(r => r !== target) })

  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 12 }}>Direction (totally optional)</div>
      <p style={{ fontSize: 14, color: 'var(--fg-3)', margin: '0 0 28px', maxWidth: 540 }}>
        Paste a Pinterest board — that&rsquo;s how most designers start. We&rsquo;ll extract the palette and
        bias finish suggestions toward it. Skip if you&rsquo;re undecided.
      </p>

      {!hasPinterest && (
        <PinterestCard
          onPullComplete={board => {
            onChange({
              refs: [...refs, {
                kind: 'pinterest',
                label: board.label,
                pins: 12,
                thumbs: board.thumbs,
                palette: board.palette,
              }],
            })
          }}
        />
      )}

      {hasPinterest && (
        <BoardsGrid refs={refs} onAdd={board => onChange({ refs: [...refs, board] })} onRemove={removeRef} />
      )}

      <div className="eyebrow" style={{ margin: '24px 0 10px', fontSize: 10 }}>
        Or add other refs
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 10, marginBottom: 18 }}>
        <ImageDropCard
          onAdd={() => onChange({
            refs: [...refs, { kind: 'image', label: 'kitchen-ref-04.jpg' }],
          })}
        />
        <LinkPasteCard
          onAdd={v => onChange({ refs: [...refs, { kind: 'link', label: v }] })}
        />
      </div>

      <OtherRefsList refs={refs} onRemove={removeRef} />
    </>
  )
}

function BoardsGrid({
  refs, onAdd, onRemove,
}: {
  refs: NPStyleRef[]
  onAdd: (board: NPStyleRef) => void
  onRemove: (r: NPStyleRef) => void
}) {
  const pinterestRefs = refs.filter(r => r.kind === 'pinterest')

  return (
    <div style={{ marginBottom: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 12, color: 'var(--accent)' }}>
        Your boards
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {pinterestRefs.map((r, i) => (
          <div key={i} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-1)',
            borderRadius: 14, overflow: 'hidden',
            boxShadow: 'var(--shadow-xs)',
            animation: 'speclyy-fade-in 320ms var(--ease-out)',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2,
              height: 140, background: 'var(--paper-200)',
            }}>
              {(r.thumbs ?? []).map((src, j) => (
                <div key={j} style={{
                  backgroundImage: `url(${src})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: 'var(--paper-200)',
                }} />
              ))}
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PinterestMark size={22} fontSize={12} />
                <div style={{
                  flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{r.label}</div>
                <button
                  type="button"
                  onClick={() => onRemove(r)}
                  aria-label="Remove board"
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--fg-4)', padding: 4, display: 'inline-flex',
                  }}
                ><XIcon size={13} /></button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
                {r.pins ?? 12} pins · palette extracted
              </div>
              {r.palette && (
                <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
                  {r.palette.map(c => (
                    <div key={c} style={{
                      flex: 1, height: 14, borderRadius: 3, background: c,
                      border: '1px solid rgba(0,0,0,.06)',
                    }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        <AddBoardTile onAddPlaceholder={url => onAdd({
          kind: 'pinterest',
          label: url,
          pins: 12,
          thumbs: [],
          palette: [],
        })}/>
      </div>
    </div>
  )
}

function AddBoardTile({ onAddPlaceholder }: { onAddPlaceholder: (url: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        const url = window.prompt('Paste another Pinterest board URL:', 'pinterest.com/yourname/')
        const trimmed = url?.trim()
        if (trimmed) onAddPlaceholder(trimmed)
      }}
      style={{
        background: 'transparent', border: '1.5px dashed var(--border-3)',
        borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 10, minHeight: 220, color: 'var(--fg-3)',
        transition: 'all var(--dur-base)',
      }}
    >
      <PinterestMark size={44} fontSize={22} />
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>Add another board</div>
      <div style={{ fontSize: 12 }}>Paste a Pinterest URL</div>
    </button>
  )
}

function ImageDropCard({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      style={{
        padding: '16px 18px', borderRadius: 12,
        background: 'var(--paper-100)', border: '1px dashed var(--border-3)',
        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: 'var(--bg-surface)', border: '1px solid var(--border-2)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--fg-2)',
      }}>
        <NPIcon d={NP_ICON_PATHS.image} size={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>Drop reference images</div>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>JPGs, PNGs, screenshots</div>
      </div>
    </button>
  )
}

function LinkPasteCard({ onAdd }: { onAdd: (url: string) => void }) {
  const [open, setOpen] = useState(false)
  const [val, setVal] = useState('')

  const submit = () => {
    const trimmed = val.trim()
    if (trimmed) { onAdd(trimmed); setVal(''); setOpen(false) }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '16px 18px', borderRadius: 12,
          background: 'var(--paper-100)', border: '1px dashed var(--border-3)',
          display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
          cursor: 'pointer', fontFamily: 'inherit', width: '100%',
        }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: 'var(--bg-surface)', border: '1px solid var(--border-2)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--fg-2)',
        }}>
          <NPIcon d={NP_ICON_PATHS.link} size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>Paste moodboard URL</div>
          <div style={{
            fontSize: 12, color: 'var(--fg-3)', marginTop: 2,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>Drive · Dropbox · Notion</span>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div style={{
      padding: '14px 14px 12px', borderRadius: 12,
      background: 'var(--bg-surface)', border: '1px solid var(--border-2)',
      animation: 'speclyy-fade-in 220ms var(--ease-out)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)' }}>Paste moodboard URL</div>
        <button
          type="button"
          onClick={() => { setOpen(false); setVal('') }}
          aria-label="Cancel"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--fg-4)', padding: 0, display: 'inline-flex',
          }}
        ><XIcon size={12} /></button>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 4px 4px 12px',
        background: 'var(--paper-100)', border: '1px solid var(--border-2)',
        borderRadius: 10,
      }}>
        <NPIcon d={NP_ICON_PATHS.link} size={14} style={{ color: 'var(--fg-3)' }} />
        <input
          value={val}
          onChange={e => setVal(e.target.value)}
          autoFocus
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') submit() }}
          placeholder="drive.google.com/… · dropbox.com/sh/…"
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--fg-1)',
            padding: '8px 0', minWidth: 0,
          }}
        />
        <Button
          variant="dark" size="sm"
          onClick={submit}
          disabled={!val.trim()}
          style={{ opacity: val.trim() ? 1 : 0.5 }}
        >Add</Button>
      </div>
      <div style={{
        fontSize: 11, color: 'var(--fg-3)', marginTop: 8,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Sparkle size={11} strokeWidth={2} />
        Public share links work best — we&rsquo;ll fetch thumbnails when possible.
      </div>
    </div>
  )
}

function OtherRefsList({
  refs, onRemove,
}: {
  refs: NPStyleRef[]
  onRemove: (r: NPStyleRef) => void
}) {
  const items = refs.filter(r => r.kind !== 'pinterest')
  if (items.length === 0) return null

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 10, fontSize: 10 }}>
        Added ({items.length})
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {items.map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 999,
            background: 'var(--bg-surface)', border: '1px solid var(--border-2)',
            fontSize: 13, color: 'var(--fg-2)',
          }}>
            <NPIcon d={r.kind === 'image' ? NP_ICON_PATHS.image : NP_ICON_PATHS.link} size={13} />
            <span style={{
              maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{r.label}</span>
            <button
              type="button"
              onClick={() => onRemove(r)}
              aria-label="Remove ref"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--fg-4)', padding: 0, display: 'inline-flex',
              }}
            ><XIcon size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
