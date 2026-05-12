'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@speclyy/design-system'
import { ArrowLeft, ArrowRight, Sparkle, X as XIcon } from '@speclyy/design-system/icons'
import { Creating } from './creating'
import { NPProgress } from './progress'
import { ScopeCommercial, ScopeResidential, ScopeStaging, SectionHeader } from './step-scope'
import { NameStep } from './step-name'
import { StyleStep } from './step-style'
import { TypePicker } from './step-type'
import { NP_TYPES, type NPData, type NPProjectTypeId } from './types'

// Speclyy wordmark used in the wizard's top bar.
function SpeclyyMark({ size = 20 }: { size?: number }) {
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

const INITIAL_DATA: NPData = { rooms: [], customRooms: [], renames: {}, refs: [] }

// The wizard's lifecycle is bound to `?new=1` in the URL. We render a
// fixed-position fullscreen overlay only when the param is present, so any
// "New project" trigger anywhere in the app — TopBar, sidebar, hub tile —
// can open the wizard with a plain Link instead of lifting state.
export function NewProjectWizard() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const isOpen = sp.get('new') === '1'

  // Lock body scroll while the wizard is up.
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  if (!isOpen) return null

  // Close returns to the current pathname (whichever (app) page the user was
  // on) with `?new` stripped — preserves other params like `demo=populated`.
  const close = () => {
    const params = new URLSearchParams(sp.toString())
    params.delete('new')
    const qs = params.toString()
    router.push(`${pathname}${qs ? `?${qs}` : ''}`)
  }

  return <Wizard onClose={close} />
}

function Wizard({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<NPData>(INITIAL_DATA)
  const [step, setStep] = useState(0)
  const [creating, setCreating] = useState(false)

  const update = (patch: Partial<NPData>) => setData(d => ({ ...d, ...patch }))
  const type = NP_TYPES.find(t => t.id === data.type)

  const stepLabel2 =
    type?.id === 'commercial' ? 'Concept & zones' :
    type?.id === 'staging' ? 'Property & target' :
    'Plan & rooms'
  const steps = ['Type', stepLabel2, 'Style', 'Name'] as const
  const lastStep = steps.length - 1

  const canAdvance = (() => {
    if (step === 0) {
      if (!data.type) return false
      if (data.type === 'other' && !(data.customLabel ?? '').trim()) return false
      return true
    }
    if (step === 1) {
      if (type?.id === 'commercial') return !!data.concept && data.rooms.length > 0
      if (type?.id === 'staging')    return !!data.propertyType && !!data.target && data.rooms.length > 0
      return data.rooms.length > 0
    }
    if (step === lastStep) return !!(data.name ?? '').trim()
    return true
  })()

  if (creating && type) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'var(--bg-app)', zIndex: 200,
        animation: 'speclyy-fade-in 200ms', display: 'flex',
      }}>
        <Creating data={data} type={type} onOpen={onClose} />
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-app)', zIndex: 200,
      animation: 'speclyy-fade-in 200ms',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{
        padding: '18px 32px',
        display: 'flex', alignItems: 'center', gap: 24,
        borderBottom: '1px solid var(--border-1)', background: 'var(--bg-surface)',
        flexShrink: 0,
      }}>
        <SpeclyyMark size={20} />
        <span style={{ width: 1, height: 22, background: 'var(--border-2)' }} />
        <span style={{ fontSize: 13, color: 'var(--fg-2)', fontWeight: 500 }}>New project</span>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <NPProgress steps={steps} current={step} />
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <XIcon size={14} /> Close
        </Button>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <section style={{
          flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
        }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '52px 64px 32px' }}>
            {step === 0 && (
              <>
                <SectionHeader
                  eyebrow="Step 1 · Project type"
                  title={<>What are you <span style={{ fontStyle: 'italic' }}>spec&rsquo;ing</span>?</>}
                  sub="Pick the closest match — or name your own. We use this to suggest the right groups, lead times, and starter scope."
                />
                <TypePicker
                  value={data.type}
                  customLabel={data.customLabel}
                  onChange={(v: NPProjectTypeId) => {
                    const t = NP_TYPES.find(x => x.id === v)
                    update({
                      type: v,
                      rooms: [...(t?.defaultRooms ?? [])],
                      customRooms: [],
                      renames: {},
                      floorPlanName: null,
                      planSkipped: false,
                      planPhase: 0,
                    })
                  }}
                  onCustomLabel={v => update({ customLabel: v })}
                />
              </>
            )}

            {step === 1 && type?.id === 'staging' && (
              <>
                <SectionHeader
                  eyebrow="Step 2 · Property & target"
                  title="What are we staging?"
                  sub="Property and listing target tune the room mix, FFE budget, and lead times."
                />
                <ScopeStaging data={data} onChange={update} />
              </>
            )}

            {step === 1 && type?.id === 'commercial' && (
              <>
                <SectionHeader
                  eyebrow="Step 2 · Concept & zones"
                  title="What kind of space?"
                  sub="Concept tunes the schedule. Zones are auto-suggested based on your concept — adjust as needed."
                />
                <ScopeCommercial data={data} onChange={update} />
              </>
            )}

            {step === 1 && type && type.id !== 'commercial' && type.id !== 'staging' && (
              <ScopeResidential data={data} onChange={update} type={type} />
            )}

            {step === 2 && (
              <>
                <SectionHeader
                  eyebrow="Step 3 · Direction"
                  title={<>Drop some <span style={{ fontStyle: 'italic' }}>refs</span> — or skip.</>}
                  sub="Reference images, a Pinterest board, a moodboard link. We'll pull the palette automatically."
                />
                <StyleStep data={data} onChange={update} />
              </>
            )}

            {step === lastStep && (
              <>
                <SectionHeader
                  eyebrow={`Step ${lastStep + 1} · Name`}
                  title="Last thing — what do you call it?"
                  sub="Just a name. Client is optional, you can fill anything else in later."
                />
                <NameStep data={data} onChange={update} type={type} />
              </>
            )}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 64px', borderTop: '1px solid var(--border-1)',
            background: 'var(--bg-surface)', flexShrink: 0,
            boxShadow: '0 -4px 16px -8px rgba(0,0,0,.06)',
          }}>
            <Button
              variant="ghost" size="md"
              onClick={() => step === 0 ? onClose() : setStep(step - 1)}
            >
              <ArrowLeft size={14} /> {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {step > 0 && step < lastStep && (
                <Button variant="ghost" size="md" onClick={() => setStep(step + 1)}>
                  Skip for now
                </Button>
              )}
              <Button
                variant={canAdvance ? 'dark' : 'ghost'}
                size="md"
                disabled={!canAdvance}
                onClick={() => {
                  if (!canAdvance) return
                  if (step === lastStep) setCreating(true)
                  else setStep(step + 1)
                }}
                style={{ opacity: canAdvance ? 1 : 0.5 }}
              >
                {step === lastStep ? 'Create project' : 'Continue'}
                {step === lastStep ? <Sparkle size={14} /> : <ArrowRight size={14} />}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
