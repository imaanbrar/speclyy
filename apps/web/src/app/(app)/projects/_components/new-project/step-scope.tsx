'use client'

import { FloorPlan } from './floor-plan'
import { RoomGrid } from './room-grid'
import {
  NP_CONCEPT_DEFAULTS,
  NP_ROOMS_RES,
  NP_STAGING_OCCUPANCY,
  NP_STAGING_PROPERTY,
  NP_STAGING_ROOMS_BASE,
  NP_STAGING_TARGET,
  NP_ZONES_COM,
  targetSuggestedRooms,
} from './data'
import type { CommercialConceptId, NPData, NPProjectType, StagingTargetId } from './types'

interface ScopeProps {
  data: NPData
  onChange: (patch: Partial<NPData>) => void
}

// --- Residential variant (new-build / reno / room-remodel / decor / other) ---
//
// Two-phase mini-flow: Step 2a "Floor plan?" then Step 2b "Rooms".
// `data.planPhase` controls which sub-step is on screen. Once a plan is
// uploaded OR the user clicks "Skip — use defaults" we advance.
export function ScopeResidential({ data, onChange, type }: ScopeProps & { type: NPProjectType }) {
  const phase = data.planPhase ?? ((data.floorPlanName || data.planSkipped) ? 1 : 0)

  if (phase === 0) {
    return (
      <>
        <SectionHeader
          eyebrow="Step 2a · Floor plan"
          title={<>Got a <span style={{ fontStyle: 'italic' }}>floor plan</span>?</>}
          sub="Upload one and we'll detect rooms automatically with their actual names. No plan? We'll start from a sensible default for your project type."
        />
        <FloorPlan
          data={data}
          onChange={patch => {
            onChange(patch)
            if (patch.floorPlanName) onChange({ planPhase: 1 })
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => onChange({
              planSkipped: true,
              planPhase: 1,
              rooms: [...(type.defaultRooms ?? [])],
            })}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 10,
              background: 'transparent', border: '1px solid var(--border-2)',
              color: 'var(--fg-2)', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
              transition: 'background var(--dur-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-100)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >Skip — use defaults →</button>
        </div>
      </>
    )
  }

  return (
    <>
      <SectionHeader
        eyebrow="Step 2b · Rooms"
        title={data.floorPlanName ? 'Detected rooms — adjust as needed.' : 'Pick the rooms in scope.'}
        sub={data.floorPlanName
          ? 'We matched names from your plan. Tap to toggle, double-click to rename, or add anything we missed.'
          : 'Pre-selected based on your project type. Toggle to adjust or add custom rooms.'}
      />
      <FloorPlan
        data={data}
        onChange={patch => {
          // Removing the plan drops the user back to defaults but stays on
          // phase 1 — we don't want to re-prompt for a floor plan.
          if (patch.floorPlanName === null) {
            onChange({
              ...patch,
              planSkipped: true,
              rooms: [...(type.defaultRooms ?? [])],
            })
          } else {
            onChange(patch)
          }
        }}
      />
      <RoomGrid
        data={data}
        onChange={onChange}
        list={NP_ROOMS_RES}
        label={data.floorPlanName ? 'Detected rooms' : 'Rooms'}
        groupByFloor
      />
    </>
  )
}

// --- Commercial variant -------------------------------------------------------
export function ScopeCommercial({ data, onChange }: ScopeProps) {
  const concepts: Array<{ id: CommercialConceptId; label: string; sub: string }> = [
    { id: 'office',      label: 'Office',      sub: 'Workspace, meetings' },
    { id: 'hospitality', label: 'Hospitality', sub: 'Hotel, F&B' },
    { id: 'retail',      label: 'Retail',      sub: 'Store, showroom' },
    { id: 'wellness',    label: 'Wellness',    sub: 'Spa, studio, clinic' },
  ]

  const selectConcept = (id: CommercialConceptId) => {
    onChange({
      concept: id,
      rooms: data.concept === id ? data.rooms : [...NP_CONCEPT_DEFAULTS[id]],
    })
  }

  return (
    <>
      <FloorPlan data={data} onChange={onChange} />
      <div className="eyebrow" style={{ marginBottom: 10 }}>Concept</div>
      <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '0 0 16px' }}>
        Pick one — we&rsquo;ll auto-suggest the right zones below.
      </p>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 30,
      }}>
        {concepts.map(c => {
          const on = data.concept === c.id
          return (
            <SelectableTile
              key={c.id}
              on={on}
              label={c.label}
              sub={c.sub}
              onClick={() => selectConcept(c.id)}
              size="lg"
            />
          )
        })}
      </div>
      {data.concept && (
        <div style={{ animation: 'speclyy-fade-in 320ms var(--ease-out)' }}>
          <RoomGrid
            data={data}
            onChange={onChange}
            list={NP_ZONES_COM}
            label="Zones (auto-suggested — adjust as needed)"
            customRoomKey="customZones"
          />
        </div>
      )}
    </>
  )
}

// --- Staging variant ----------------------------------------------------------
export function ScopeStaging({ data, onChange }: ScopeProps) {
  const selectTarget = (id: StagingTargetId) => {
    onChange({
      target: id,
      rooms: data.target === id ? data.rooms : [...targetSuggestedRooms(id)],
    })
  }

  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Property type</div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28,
      }}>
        {NP_STAGING_PROPERTY.map(p => (
          <SelectableTile
            key={p.id}
            on={data.propertyType === p.id}
            label={p.label}
            sub={p.sub}
            onClick={() => onChange({ propertyType: p.id })}
            size="md"
          />
        ))}
      </div>

      <div className="eyebrow" style={{ marginBottom: 10 }}>Listing target</div>
      <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '0 0 14px' }}>
        Tunes the rooms, lead times, and FFE budget defaults.
      </p>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28,
      }}>
        {NP_STAGING_TARGET.map(t => (
          <SelectableTile
            key={t.id}
            on={data.target === t.id}
            label={t.label}
            sub={t.sub}
            onClick={() => selectTarget(t.id)}
            size="md"
          />
        ))}
      </div>

      <div className="eyebrow" style={{ marginBottom: 10 }}>Occupancy</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {NP_STAGING_OCCUPANCY.map(o => {
          const on = data.occupancy === o.id
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange({ occupancy: o.id })}
              style={{
                flex: 1, padding: '14px 16px', borderRadius: 10,
                background: on ? 'var(--ink-900)' : 'var(--bg-surface)',
                color: on ? 'var(--paper-50)' : 'var(--fg-1)',
                border: `1.5px solid ${on ? 'var(--ink-900)' : 'var(--border-2)'}`,
                cursor: 'pointer', textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'all var(--dur-base)',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>{o.label}</div>
              <div style={{ fontSize: 11, marginTop: 2, opacity: on ? 0.7 : 1 }}>{o.sub}</div>
            </button>
          )
        })}
      </div>

      {data.target && (
        <div style={{ animation: 'speclyy-fade-in 320ms var(--ease-out)' }}>
          <FloorPlan data={data} onChange={onChange} />
          <RoomGrid
            data={data}
            onChange={onChange}
            list={NP_STAGING_ROOMS_BASE}
            label="Rooms to stage"
          />
        </div>
      )}
    </>
  )
}

// --- Shared atoms -------------------------------------------------------------

function SectionHeader({
  eyebrow, title, sub,
}: {
  eyebrow: string
  title: React.ReactNode
  sub: string
}) {
  return (
    <header style={{ marginBottom: 32 }}>
      <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--accent)' }}>{eyebrow}</div>
      <h2 style={{
        margin: 0, fontFamily: 'var(--font-display)',
        fontSize: 32, lineHeight: 1.15, fontWeight: 400, letterSpacing: '-0.015em',
        fontVariationSettings: '"opsz" 144, "SOFT" 50',
        paddingBottom: 6,
      }}>{title}</h2>
      {sub && (
        <p style={{
          margin: '12px 0 0', maxWidth: 640,
          fontSize: 14, color: 'var(--fg-3)', lineHeight: 1.55,
        }}>{sub}</p>
      )}
    </header>
  )
}

function SelectableTile({
  on, label, sub, onClick, size,
}: {
  on: boolean
  label: string
  sub: string
  onClick: () => void
  size: 'md' | 'lg'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: size === 'lg' ? '20px 18px' : '16px 16px',
        borderRadius: 12,
        background: on ? 'var(--ink-900)' : 'var(--bg-surface)',
        color: on ? 'var(--paper-50)' : 'var(--fg-1)',
        border: `1.5px solid ${on ? 'var(--ink-900)' : 'var(--border-2)'}`,
        cursor: 'pointer', textAlign: 'left',
        fontFamily: 'inherit',
        boxShadow: on ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        transform: on ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all var(--dur-base)',
      }}
    >
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: size === 'lg' ? 20 : 18, fontWeight: 400,
      }}>{label}</div>
      <div style={{
        fontSize: 12, marginTop: 2,
        opacity: on ? 0.7 : 1,
        color: on ? 'var(--paper-50)' : 'var(--fg-3)',
      }}>{sub}</div>
    </button>
  )
}

export { SectionHeader }
