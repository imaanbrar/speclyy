'use client'

/**
 * UrlDemoIsland — React island.
 * User types/pastes a URL, we simulate the scrape and reveal fields one by one.
 * Styled via Speclyy design-system tokens.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const DEMO_URL = 'deltafaucet.com/product/T14094-I'

const DEMO_FIELDS = [
  { label: 'Brand',      value: 'Delta Faucet',     mono: false },
  { label: 'Collection', value: 'Ashlyn®',          mono: false },
  { label: 'Finish',     value: 'Champagne Bronze', mono: false },
  { label: 'SKU',        value: 'T14094-CZ',        mono: true  },
  { label: 'Dimensions', value: '8″ widespread',    mono: true  },
]

type DemoState = 'idle' | 'loading' | 'done'

export default function UrlDemoIsland() {
  const [url,     setUrl]     = useState('')
  const [state,   setState]   = useState<DemoState>('idle')
  const [visible, setVisible] = useState(0)

  function runDemo() {
    if (state !== 'idle') return
    setState('loading')
    setVisible(0)
    setTimeout(() => setState('done'), 420)
  }

  useEffect(() => {
    if (state !== 'done') return
    let i = 0
    const iv = setInterval(() => {
      i++; setVisible(i)
      if (i >= DEMO_FIELDS.length) clearInterval(iv)
    }, 280)
    return () => clearInterval(iv)
  }, [state])

  function reset() {
    setState('idle'); setUrl(''); setVisible(0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p className="eyebrow">Try it</p>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={state === 'idle' ? url : DEMO_URL}
          onChange={e => setUrl(e.target.value)}
          placeholder="Paste a product URL…"
          disabled={state !== 'idle'}
          className="input"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 13, background: 'var(--paper-50)' }}
        />
        <button
          onClick={state === 'done' ? reset : runDemo}
          className="btn btn-dark btn-sm"
          style={{ whiteSpace: 'nowrap' }}
        >
          {state === 'done' ? 'Reset' : state === 'loading' ? 'Fetching…' : 'Fetch'}
        </button>
      </div>

      <AnimatePresence>
        {state !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'var(--paper-50)',
              border: '1px solid var(--border-1)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            {DEMO_FIELDS.map((field, i) => (
              <div
                key={field.label}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px',
                  borderBottom: i === DEMO_FIELDS.length - 1 ? 'none' : '1px solid var(--border-1)',
                }}
              >
                <span className="eyebrow" style={{ color: 'var(--fg-3)' }}>{field.label}</span>
                {i < visible ? (
                  <motion.span
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                      fontFamily: field.mono ? 'var(--font-mono)' : 'var(--font-body)',
                      fontSize: field.mono ? 12 : 14,
                      fontWeight: 500,
                      color: 'var(--fg-1)',
                    }}
                  >
                    {field.value}
                  </motion.span>
                ) : (
                  <span
                    aria-hidden
                    style={{
                      height: 10, width: 112, borderRadius: 4,
                      background: 'var(--paper-200)',
                      animation: 'pulse 1.6s ease-in-out infinite',
                    }}
                  />
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }`}</style>
    </div>
  )
}
