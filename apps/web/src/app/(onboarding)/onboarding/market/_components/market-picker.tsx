'use client'

import { useActionState, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button } from '@speclyy/design-system'
import { ArrowLeft, ArrowRight, Check, MapPin, Search } from '@speclyy/design-system/icons'
import { saveMarket, type MarketActionState } from '../actions'

interface CityResult {
  id: string
  label: string
}

interface MarketPickerProps {
  detectedLabel: string | null
  initialMarket: string
}

type PanelMode = 'detected' | 'search'

export function MarketPicker({ detectedLabel, initialMarket }: MarketPickerProps) {
  const initialMode: PanelMode =
    detectedLabel && (initialMarket === '' || initialMarket === detectedLabel) ? 'detected' : 'search'
  const [mode, setMode] = useState<PanelMode>(initialMode)
  const [picked, setPicked] = useState<string>(
    initialMode === 'detected' ? detectedLabel ?? '' : initialMarket,
  )

  const [state, formAction, pending] = useActionState<MarketActionState, FormData>(saveMarket, {
    values: { market: picked },
  })
  const errors = state.errors ?? {}

  // True once the user has picked a non-detected city from the typeahead.
  // In that state the SelectedCard is the user's committed choice — showing
  // an unselected DetectedCard alongside it is just visual noise (and the
  // SelectedCard's Change link covers the "go back" path: it clears `picked`,
  // which re-reveals both DetectedCard and the expanded SearchCard).
  const showSelectedCard =
    mode === 'search' && picked.length > 0 && picked !== detectedLabel

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="market" value={picked} />

      {detectedLabel && !showSelectedCard && (
        <DetectedCard
          label={detectedLabel}
          selected={mode === 'detected'}
          onSelect={() => {
            setMode('detected')
            setPicked(detectedLabel)
          }}
        />
      )}

      {showSelectedCard ? (
        // Once the user has picked a city from the typeahead we collapse the
        // search panel into a confirmation card mirroring DetectedCard's
        // visual treatment. "Change" clears `picked`, which re-renders the
        // expanded SearchCard for a fresh search. We unmount CitySearch
        // here intentionally — its internal query/results state is per-pick
        // throwaway, not session state worth preserving.
        <SelectedCard label={picked} onChange={() => setPicked('')} />
      ) : (
        <SearchCard
          expanded={mode === 'search'}
          initialQuery=""
          initialPicked=""
          onOpen={() => {
            setMode('search')
            if (picked === detectedLabel) setPicked('')
          }}
          onPick={(label) => {
            // If the user happens to pick the detected city through search,
            // promote it to detected mode so the detected card shows
            // selected and the user doesn't see two redundant cards.
            if (detectedLabel && label === detectedLabel) {
              setMode('detected')
            }
            setPicked(label)
          }}
        />
      )}

      {(errors.market || errors.form) && (
        <p className="body-sm" role="alert" style={{ color: 'var(--status-missing)' }}>
          {errors.market ?? errors.form}
        </p>
      )}

      <div className="flex items-center justify-between mt-2">
        <a href="/onboarding/studio" className="btn btn-text" aria-label="Back to step 2">
          <ArrowLeft size={16} /> Back
        </a>
        <Button
          type="submit"
          variant="dark"
          disabled={pending || picked.trim().length === 0}
          aria-busy={pending}
        >
          {pending ? 'Saving…' : 'Continue'} <ArrowRight size={16} />
        </Button>
      </div>
    </form>
  )
}

function DetectedCard({
  label,
  selected,
  onSelect,
}: {
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="card card-hover text-left flex items-start gap-4"
      style={{
        borderColor: selected ? 'var(--ink-900)' : 'var(--border-1)',
        boxShadow: selected ? 'var(--shadow-sm)' : 'none',
      }}
    >
      <span
        className="grid place-items-center"
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--terracotta-50)',
          color: 'var(--terracotta-600)',
          flexShrink: 0,
        }}
      >
        <MapPin size={20} />
      </span>
      <div className="flex-1">
        <p className="eyebrow" style={{ color: 'var(--terracotta-600)' }}>Detected</p>
        <p className="h4 mt-1">{label}</p>
        <p className="caption mt-1">Confirmed from your network — change if it&rsquo;s wrong.</p>
      </div>
    </button>
  )
}

function SelectedCard({
  label,
  onChange,
}: {
  label: string
  onChange: () => void
}) {
  // Visually mirrors DetectedCard's "selected" state (terracotta icon
  // medallion, ink-900 border, sm shadow) but: not a radio — it's already
  // committed to `picked` — and pairs with an inline Change link instead.
  // We use role="status" + aria-live so screen readers announce "Selected:
  // <city>" when CitySearch hands off.
  return (
    <div
      className="card flex items-start gap-4"
      role="status"
      aria-live="polite"
      style={{
        borderColor: 'var(--ink-900)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <span
        className="grid place-items-center"
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--terracotta-50)',
          color: 'var(--terracotta-600)',
          flexShrink: 0,
        }}
      >
        <MapPin size={20} />
      </span>
      <div className="flex-1">
        <p className="eyebrow" style={{ color: 'var(--terracotta-600)' }}>Selected</p>
        <p className="h4 mt-1">{label}</p>
        <p className="caption mt-1">
          Picked from search.{' '}
          <button
            type="button"
            onClick={onChange}
            style={{
              background: 'none',
              border: 0,
              padding: 0,
              cursor: 'pointer',
              color: 'var(--fg-1)',
              textDecoration: 'underline',
              font: 'inherit',
            }}
          >
            Change
          </button>
        </p>
      </div>
      <Check
        size={20}
        aria-hidden
        style={{ color: 'var(--ink-900)', flexShrink: 0, alignSelf: 'center' }}
      />
    </div>
  )
}

function SearchCard({
  expanded,
  initialQuery,
  initialPicked,
  onOpen,
  onPick,
}: {
  expanded: boolean
  initialQuery: string
  initialPicked: string
  onOpen: () => void
  onPick: (label: string) => void
}) {
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="card card-hover text-left flex items-center gap-4"
      >
        <span
          className="grid place-items-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--bg-subtle)',
            color: 'var(--fg-2)',
            flexShrink: 0,
          }}
        >
          <Search size={18} />
        </span>
        <div className="flex-1">
          <p className="h4">Somewhere else</p>
          <p className="caption mt-1">Search any city or region in the world.</p>
        </div>
        <span aria-hidden style={{ color: 'var(--fg-3)' }}>→</span>
      </button>
    )
  }
  return (
    <CitySearch initialQuery={initialQuery} initialPicked={initialPicked} onPick={onPick} />
  )
}

function CitySearch({
  initialQuery,
  initialPicked,
  onPick,
}: {
  initialQuery: string
  initialPicked: string
  onPick: (label: string) => void
}) {
  const listId = useId()
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<CityResult[]>([])
  const [picked, setPicked] = useState(initialPicked)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const trimmed = useMemo(() => query.trim(), [query])

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    abortRef.current?.abort()
    const ctl = new AbortController()
    abortRef.current = ctl
    const t = window.setTimeout(async () => {
      const t0 = performance.now()
      console.log('[market-picker] → fetch q=%o', trimmed)
      try {
        const res = await fetch(`/api/onboarding/cities?q=${encodeURIComponent(trimmed)}`, {
          signal: ctl.signal,
        })
        const json = (await res.json().catch(() => null)) as
          | { results?: CityResult[]; reason?: string }
          | null
        if (!res.ok) {
          if (res.status === 401) throw new Error('signed_out')
          if (json?.reason === 'auth') throw new Error('auth_unavailable')
          throw new Error(`status_${res.status}`)
        }
        console.log(
          '[market-picker] ← %d hits in %dms (q=%o)',
          json?.results?.length ?? 0,
          Math.round(performance.now() - t0),
          trimmed,
        )
        setResults(json?.results ?? [])
      } catch (err) {
        const e = err as { name?: string; message?: string }
        // Log AbortError too — silent abort is exactly what's hiding the bug
        // we're trying to diagnose. Don't surface it as a UI error though.
        if (e.name === 'AbortError') {
          console.warn(
            '[market-picker] ✕ aborted after %dms (q=%o)',
            Math.round(performance.now() - t0),
            trimmed,
          )
          return
        }
        console.error('[market-picker] city search failed:', e.message ?? err, { trimmed })
        setError(
          e.message === 'signed_out'
            ? 'Your session expired — refresh the page to sign in again.'
            : e.message === 'auth_unavailable'
              ? "Couldn't verify your session. Try again in a moment."
              : "Couldn't reach the city service.",
        )
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      window.clearTimeout(t)
      ctl.abort()
    }
  }, [trimmed])

  const showEmpty = !loading && trimmed.length >= 2 && results.length === 0 && !error

  return (
    <div className="card flex flex-col gap-3">
      <label htmlFor="city-search" className="eyebrow">Find your city</label>
      <div className="flex items-center gap-2 input" style={{ paddingTop: 8, paddingBottom: 8 }}>
        <Search size={16} aria-hidden style={{ color: 'var(--fg-3)' }} />
        <input
          id="city-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a city or region — we'll match as you go"
          autoFocus
          autoComplete="off"
          aria-controls={listId}
          aria-expanded={results.length > 0}
          style={{
            flex: 1,
            border: 0,
            background: 'transparent',
            outline: 'none',
            fontSize: 14,
            color: 'var(--fg-1)',
          }}
        />
        {loading && <span className="caption">Searching…</span>}
      </div>

      {error && <p className="body-sm" role="alert" style={{ color: 'var(--status-missing)' }}>{error}</p>}

      {showEmpty && (
        <p className="caption">No cities matched. Try a different spelling.</p>
      )}

      {results.length > 0 && (
        <ul id={listId} role="listbox" className="flex flex-col gap-1">
          {results.map((r) => {
            const active = picked === r.label
            return (
              <li key={r.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setPicked(r.label)
                    onPick(r.label)
                  }}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md"
                  style={{
                    background: active ? 'var(--bg-hover)' : 'transparent',
                    border: '1px solid transparent',
                    transition: 'background var(--dur-fast)',
                  }}
                >
                  <MapPin size={16} aria-hidden style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
                  <span className="body-sm" style={{ color: 'var(--fg-1)' }}>{r.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {picked && results.length === 0 && trimmed.length < 2 && (
        <p className="caption">Selected: <strong style={{ color: 'var(--fg-1)' }}>{picked}</strong></p>
      )}
    </div>
  )
}
