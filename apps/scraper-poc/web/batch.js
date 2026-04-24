// Batch client — paste N URLs, run them sequentially, render a card per URL.
//   - Splits textarea by newline, trims, dedupes, validates with URL()
//   - Renders a "pending" card for each URL *before* firing requests, so the
//     user sees layout immediately
//   - Walks the list one at a time (no parallel fan-out) with a fixed sleep
//     between requests — Claude's 50k-tokens/min per-workspace limit is
//     what we're pacing against; a single rendered page can push ~15k
//     input tokens, so 3 back-to-back requests already risk a 429
//   - After the run finishes, shows average wall time per URL
// No bundler. Vanilla ES modules-as-scripts.

const REQUEST_GAP_MS = 10_000

const form          = document.getElementById('batch-form')
const urlsInput     = document.getElementById('urls-input')
const button        = document.getElementById('batch-btn')
const stopButton    = document.getElementById('stop-btn')
const noCacheInput  = document.getElementById('no-cache')
const statusEl      = document.getElementById('batch-status')
const resultsEl     = document.getElementById('batch-results')

function parseUrls(raw) {
  const seen = new Set()
  const urls = []
  for (const line of raw.split(/\r?\n/)) {
    const s = line.trim()
    if (!s || seen.has(s)) continue
    try { new URL(s) } catch { continue }
    seen.add(s)
    urls.push(s)
  }
  return urls
}

function setRunning(running) {
  button.hidden = running
  stopButton.hidden = !running
  urlsInput.disabled = running
  noCacheInput.disabled = running
}

function makePendingCard(url) {
  const card = document.createElement('article')
  card.className = 'batch-card pending'

  const header = document.createElement('div')
  header.className = 'batch-card-header'
  const pill = document.createElement('span')
  pill.className = 'pill pending'
  pill.textContent = 'pending'
  const timing = document.createElement('span')
  timing.className = 'meta batch-card-timing'
  timing.textContent = ''
  header.appendChild(pill)
  header.appendChild(timing)

  const img = document.createElement('img')
  img.className = 'batch-card-img'
  img.alt = ''

  const name = document.createElement('div')
  name.className = 'batch-card-name'
  name.textContent = new URL(url).hostname

  const meta = document.createElement('div')
  meta.className = 'batch-card-meta empty'
  meta.textContent = 'waiting…'

  const link = document.createElement('a')
  link.className = 'batch-card-link'
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener'
  link.textContent = url

  card.appendChild(header)
  card.appendChild(img)
  card.appendChild(name)
  card.appendChild(meta)
  card.appendChild(link)

  return { card, pill, timing, img, name, meta }
}

function renderSuccess(nodes, response) {
  const entry = response.entry || {}
  const data  = entry.extractedData || {}
  const metrics = response.metrics || null

  nodes.card.classList.remove('pending')
  nodes.card.classList.add('ok')

  const pathLabel = metrics ? metrics.path : (entry.status === 'failed' ? 'failed' : 'cache')
  nodes.pill.className = 'pill'
  nodes.pill.textContent = pathLabel

  const timingParts = []
  if (response.source === 'cache') timingParts.push('cached')
  if (typeof response.wallMs === 'number') timingParts.push(`${response.wallMs}ms`)
  nodes.timing.textContent = timingParts.join(' · ')

  if (data.image_url) {
    nodes.img.src = data.image_url
    nodes.img.alt = data.product_name || 'product image'
  } else {
    nodes.img.removeAttribute('src')
    nodes.img.alt = 'no image'
  }

  nodes.name.textContent = data.product_name || '(no name)'

  const metaBits = []
  if (data.brand) metaBits.push(data.brand)
  if (data.sku) metaBits.push(`SKU ${data.sku}`)
  if (metaBits.length) {
    nodes.meta.className = 'batch-card-meta'
    nodes.meta.textContent = metaBits.join(' · ')
  } else {
    nodes.meta.className = 'batch-card-meta empty'
    nodes.meta.textContent = '—'
  }
}

function renderError(nodes, message) {
  nodes.card.classList.remove('pending')
  nodes.card.classList.add('err')
  nodes.pill.className = 'pill err'
  nodes.pill.textContent = 'error'
  nodes.timing.textContent = ''
  nodes.img.removeAttribute('src')
  nodes.img.alt = 'error'
  nodes.name.textContent = 'Failed'
  nodes.meta.className = 'batch-card-meta err'
  nodes.meta.textContent = message
}

function renderStopped(nodes) {
  nodes.card.classList.remove('pending')
  nodes.card.classList.add('stopped')
  nodes.pill.className = 'pill'
  nodes.pill.textContent = 'stopped'
  nodes.timing.textContent = ''
  nodes.img.removeAttribute('src')
  nodes.img.alt = 'stopped'
  nodes.name.textContent = 'Stopped'
  nodes.meta.className = 'batch-card-meta empty'
  nodes.meta.textContent = 'cancelled'
}

async function extractOne(url, noCache, signal) {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, noCache }),
    signal,
  })
  const body = await res.json().catch(() => ({ error: 'non-JSON server response' }))
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${body.error ?? 'unknown'}`)
  }
  if (body?.entry?.status === 'failed') {
    throw new Error(body.entry.errorMessage ?? 'scrape failed')
  }
  return body
}

let stopRequested = false
let currentAbort = null

stopButton.addEventListener('click', () => {
  stopRequested = true
  if (currentAbort) currentAbort.abort()
})

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const urls = parseUrls(urlsInput.value)
  if (urls.length === 0) {
    statusEl.textContent = 'No valid URLs.'
    return
  }

  resultsEl.innerHTML = ''
  const nodesByUrl = new Map()
  for (const url of urls) {
    const nodes = makePendingCard(url)
    resultsEl.appendChild(nodes.card)
    nodesByUrl.set(url, nodes)
  }

  stopRequested = false
  currentAbort = null
  setRunning(true)
  const noCache = noCacheInput.checked
  const total = urls.length
  let done = 0
  let ok = 0
  let failed = 0
  let totalMs = 0

  // Single source of truth for the status line. Live rate + avg are shown
  // from the first completed request; before that only counters are useful.
  // `inFlightSec` / `waitingSec` append phase-specific detail.
  const renderStatus = ({ finished = false, inFlightSec = null, waitingSec = null } = {}) => {
    const rate = done === 0 ? 0 : Math.round((ok / done) * 100)
    const avgMs = done === 0 ? 0 : Math.round(totalMs / done)
    const label = finished ? 'done' : 'complete'
    const parts = [
      `${done} / ${total} ${label}`,
      `${ok} ok`,
      `${failed} failed`,
    ]
    if (done > 0) parts.push(`${rate}% success`, `avg ${avgMs}ms`)
    if (inFlightSec !== null) parts.push(`current ${inFlightSec}s`)
    if (waitingSec !== null) parts.push(`next in ${waitingSec}s`)
    statusEl.textContent = parts.join(' · ')
  }
  renderStatus()

  outer: for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    const nodes = nodesByUrl.get(url)
    const reqStart = Date.now()
    const ctrl = new AbortController()
    currentAbort = ctrl
    // Tick the elapsed counter every second while this request is in flight.
    renderStatus({ inFlightSec: 0 })
    const ticker = setInterval(() => {
      renderStatus({
        inFlightSec: Math.round((Date.now() - reqStart) / 1000),
      })
    }, 1000)
    let wasStopped = false
    try {
      const response = await extractOne(url, noCache, ctrl.signal)
      renderSuccess(nodes, response)
      ok += 1
    } catch (err) {
      if (stopRequested || err?.name === 'AbortError') {
        wasStopped = true
        renderStopped(nodes)
      } else {
        renderError(nodes, err?.message ?? String(err))
        failed += 1
      }
    } finally {
      clearInterval(ticker)
      currentAbort = null
      if (!wasStopped) {
        totalMs += Date.now() - reqStart
        done += 1
      }
      renderStatus({ finished: done === total && !wasStopped })
    }
    if (wasStopped) {
      // Mark any not-yet-started URLs as stopped so the grid reflects the
      // user's intent — we never reached them.
      for (let j = i + 1; j < urls.length; j++) {
        renderStopped(nodesByUrl.get(urls[j]))
      }
      break outer
    }
    // Pace against Claude's per-minute token limit. Skip the gap after
    // the last request — nothing to wait for. Check stopRequested each
    // tick so the user can cancel without waiting the full 10s.
    if (i < urls.length - 1) {
      const gapSec = REQUEST_GAP_MS / 1000
      for (let remaining = gapSec; remaining > 0; remaining--) {
        if (stopRequested) {
          for (let j = i + 1; j < urls.length; j++) {
            renderStopped(nodesByUrl.get(urls[j]))
          }
          break outer
        }
        renderStatus({ waitingSec: remaining })
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
  }

  renderStatus({ finished: true })
  setRunning(false)
})
