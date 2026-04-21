'use client'

/**
 * UrlDemoIsland — React Island
 *
 * Interactive demo: user types/pastes a URL, we simulate the scrape animation
 * and show extracted fields populating one by one.
 *
 * This is the only interactive component on the marketing page. Everything else
 * is pure Astro (zero JS).
 *
 * Loaded with client:visible — hydrates only when scrolled into view.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const DEMO_URL = 'deltafaucet.com/product/T14094-I'

const DEMO_FIELDS = [
  { label: 'Brand',       value: 'Delta Faucet',           delay: 600 },
  { label: 'Collection',  value: 'Ashlyn®',                delay: 900 },
  { label: 'Finish',      value: 'Champagne Bronze',       delay: 1200 },
  { label: 'SKU',         value: 'T14094-CZ',              delay: 1500 },
  { label: 'Dimensions',  value: '8″ widespread',          delay: 1800 },
]

type DemoState = 'idle' | 'loading' | 'done'

export default function UrlDemoIsland() {
  const [url,    setUrl]    = useState('')
  const [state,  setState]  = useState<DemoState>('idle')
  const [visible, setVisible] = useState<number>(0)

  function runDemo() {
    if (state === 'loading') return
    setState('loading')
    setVisible(0)

    // Simulate scrape duration
    const timer = setTimeout(() => {
      setState('done')
    }, 400)

    return () => clearTimeout(timer)
  }

  useEffect(() => {
    if (state !== 'done') return
    let i = 0
    const interval = setInterval(() => {
      i++
      setVisible(i)
      if (i >= DEMO_FIELDS.length) clearInterval(interval)
    }, 320)
    return () => clearInterval(interval)
  }, [state])

  function reset() {
    setState('idle')
    setUrl('')
    setVisible(0)
  }

  return (
    <div className="space-y-4 font-sans">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">
        Try it
      </p>

      {/* URL input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={state === 'idle' ? url : DEMO_URL}
          onChange={e => setUrl(e.target.value)}
          placeholder="Paste a product URL…"
          disabled={state !== 'idle'}
          className="flex-1 rounded-lg border border-neutral-200 bg-white px-4 py-2.5
                     text-sm text-neutral-800 placeholder:text-neutral-400
                     focus:outline-none focus:ring-2 focus:ring-brand-400
                     disabled:opacity-60 transition"
        />
        <button
          onClick={state === 'done' ? reset : runDemo}
          className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold
                     text-white hover:bg-brand-600 transition-colors whitespace-nowrap"
        >
          {state === 'done' ? 'Reset' : state === 'loading' ? 'Fetching…' : 'Fetch'}
        </button>
      </div>

      {/* Extracted fields */}
      <AnimatePresence>
        {state !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden"
          >
            {DEMO_FIELDS.map((field, i) => (
              <div key={field.label} className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-medium text-neutral-400 w-24">{field.label}</span>
                <AnimatePresence>
                  {i < visible ? (
                    <motion.span
                      key="value"
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-sm text-neutral-800 font-medium"
                    >
                      {field.value}
                    </motion.span>
                  ) : (
                    <motion.div
                      key="skeleton"
                      className="h-3 rounded bg-neutral-100 w-28 animate-pulse"
                    />
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
