'use client'

import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Check, Plus, X as XIcon } from '@speclyy/design-system/icons'
import { NPIcon } from './icons'
import { NP_FLOOR_ORDER, NP_ROOM_FLOORS, type IconPath } from './data'
import type { NPData } from './types'

interface RoomChipProps {
  label: string
  icon: IconPath
  on: boolean
  onToggle: () => void
  onRename?: (next: string) => void
}

export function RoomChip({ label, icon, on, onToggle, onRename }: RoomChipProps) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(label)
  useEffect(() => { setVal(label) }, [label])

  const submit = () => {
    const trimmed = val.trim()
    if (trimmed && trimmed !== label && onRename) onRename(trimmed)
    else setVal(label)
    setEditing(false)
  }

  return (
    <div
      onClick={() => { if (!editing) onToggle() }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px',
        background: on ? 'var(--ink-900)' : 'var(--bg-surface)',
        color: on ? 'var(--paper-50)' : 'var(--fg-1)',
        border: `1px solid ${on ? 'var(--ink-900)' : 'var(--border-2)'}`,
        borderRadius: 12, cursor: 'pointer',
        fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
        boxShadow: on ? 'var(--shadow-sm)' : 'var(--shadow-xs)',
        transition: 'all var(--dur-base) var(--ease-out)',
        transform: on ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      <span style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: on ? 'rgba(255,255,255,.12)' : 'var(--paper-100)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: on ? 'var(--paper-50)' : 'var(--fg-2)',
      }}>
        <NPIcon d={icon} size={15} />
      </span>

      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onClick={(e: MouseEvent<HTMLInputElement>) => e.stopPropagation()}
          onBlur={submit}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') { setVal(label); setEditing(false) }
          }}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'inherit', font: 'inherit', padding: 0,
            borderBottom: `1px solid ${on ? 'rgba(255,255,255,.4)' : 'var(--border-3)'}`,
          }}
        />
      ) : (
        <span
          style={{ flex: 1 }}
          onDoubleClick={(e: MouseEvent<HTMLSpanElement>) => {
            if (on && onRename) { e.stopPropagation(); setEditing(true) }
          }}
        >{label}</span>
      )}

      {on && !editing && onRename && (
        <button
          type="button"
          onClick={(e: MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); setEditing(true) }}
          title="Rename"
          aria-label="Rename room"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,.55)', padding: 2, display: 'inline-flex',
          }}
        ><NPIcon d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" size={12} /></button>
      )}
      {on && !editing && <Check size={14} strokeWidth={2.5} />}
    </div>
  )
}

interface AddCustomChipProps {
  onAdd: (name: string) => void
  placeholder?: string
}

export function AddCustomChip({ onAdd, placeholder = 'Add your own…' }: AddCustomChipProps) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')

  const submit = () => {
    const trimmed = val.trim()
    if (trimmed) { onAdd(trimmed); setVal('') }
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px', borderRadius: 12,
        background: 'var(--bg-surface)',
        border: '1.5px solid var(--accent)',
      }}>
        <Plus size={15} style={{ color: 'var(--accent)' }} />
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={submit}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') { setVal(''); setEditing(false) }
          }}
          placeholder={placeholder}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
            color: 'var(--fg-1)',
          }}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px', borderRadius: 12,
        background: 'transparent', cursor: 'pointer',
        border: '1.5px dashed var(--border-3)',
        color: 'var(--fg-3)', fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
        transition: 'all var(--dur-base)',
      }}
    >
      <Plus size={15} /> Add your own
    </button>
  )
}

interface RoomGridProps {
  data: NPData
  onChange: (patch: Partial<NPData>) => void
  list: ReadonlyArray<readonly [string, IconPath]>
  label: string
  customRoomKey?: 'customRooms' | 'customZones'
  groupByFloor?: boolean
}

export function RoomGrid({
  data, onChange, list, label,
  customRoomKey = 'customRooms',
  groupByFloor = false,
}: RoomGridProps) {
  const customs = (data[customRoomKey] ?? []) as string[]
  const renames = data.renames ?? {}
  const planParsed = !!data.floorPlanName
  const selectedSet = new Set(data.rooms)
  const baseRooms = planParsed
    ? list.filter(([key]) => selectedSet.has(key))
    : list

  const seen = new Set<string>()
  const allRooms: Array<readonly [string, IconPath]> = []
  for (const r of baseRooms) {
    if (seen.has(r[0])) continue
    seen.add(r[0])
    allRooms.push(r)
  }
  for (const c of customs) {
    if (seen.has(c)) continue
    seen.add(c)
    allRooms.push([c, 'M3 6h18M3 12h18M3 18h18'])
  }

  const toggleRoom = (key: string) => {
    const on = selectedSet.has(key)
    onChange({
      rooms: on ? data.rooms.filter(x => x !== key) : [...data.rooms, key],
    })
  }

  const renameRoom = (key: string, v: string) => {
    onChange({ renames: { ...renames, [key]: v } })
  }

  const addCustom = (name: string, floor?: string) => {
    const patch: Partial<NPData> = {
      [customRoomKey]: [...customs, name],
      rooms: [...data.rooms, name],
    } as Partial<NPData>
    if (floor) {
      patch.customRoomFloors = { ...(data.customRoomFloors ?? {}), [name]: floor }
    }
    onChange(patch)
  }

  const renderChip = ([key, iconPath]: readonly [string, IconPath]) => {
    const display = renames[key] ?? key
    return (
      <RoomChip
        key={key}
        label={display}
        icon={iconPath}
        on={selectedSet.has(key)}
        onToggle={() => toggleRoom(key)}
        onRename={v => renameRoom(key, v)}
      />
    )
  }

  if (groupByFloor) {
    const customFloors = data.customRoomFloors ?? {}
    const buckets: Record<string, Array<readonly [string, IconPath]>> = {
      'Main floor': [], 'Second floor': [], 'Basement': [],
    }
    for (const r of allRooms) {
      const f = customFloors[r[0]] ?? NP_ROOM_FLOORS[r[0]] ?? 'Main floor'
      buckets[f].push(r)
    }
    return (
      <>
        <GridHeader label={label} count={data.rooms.length} />
        {NP_FLOOR_ORDER.map(floor => {
          const rooms = buckets[floor]
          if (!rooms.length && floor !== 'Main floor') return null
          return (
            <div key={floor} style={{ marginBottom: 22 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
                fontFamily: 'var(--font-display)', fontWeight: 400,
                color: 'var(--fg-2)', fontSize: 22,
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: 6,
                  background: 'var(--paper-200)', color: 'var(--fg-2)',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {floor === 'Main floor' ? '1' : floor === 'Second floor' ? '2' : 'B'}
                </span>
                {floor}
                <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-body)' }}>
                  · {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {rooms.map(renderChip)}
                <AddCustomChip
                  placeholder={
                    floor === 'Basement' ? 'e.g. Wine cellar' :
                    floor === 'Second floor' ? 'e.g. Nursery' :
                    'e.g. Sunroom'
                  }
                  onAdd={name => addCustom(name, floor)}
                />
              </div>
            </div>
          )
        })}
      </>
    )
  }

  return (
    <>
      <GridHeader label={label} count={data.rooms.length} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {allRooms.map(renderChip)}
        <AddCustomChip
          placeholder="e.g. Wine cellar, Tennis court"
          onAdd={name => addCustom(name)}
        />
      </div>
    </>
  )
}

function GridHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 12,
    }}>
      <div className="eyebrow">{label}</div>
      <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
        {count} selected · double-click to rename
      </div>
    </div>
  )
}

// Re-export X so step files can import a close icon next to the room grid.
export { XIcon }
