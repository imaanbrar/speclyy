// Minimal client for the scraper POC.
//   - Submits { url } to /api/extract
//   - Renders the returned ScrapeResult into the result card
//   - Image is shown as <img>, not as a URL string
// No bundler. Vanilla ES modules-as-scripts.

const form          = document.getElementById('extract-form')
const urlInput      = document.getElementById('url-input')
const button        = document.getElementById('extract-btn')
const statusEl      = document.getElementById('status')
const resultEl      = document.getElementById('result')
const pathEl        = document.getElementById('result-path')
const timingEl      = document.getElementById('result-timing')
const imgEl         = document.getElementById('result-img')
const imgCaptionEl  = document.getElementById('result-img-caption')
const fieldsEl      = document.getElementById('result-fields')
const rawJsonEl     = document.getElementById('result-raw-json')

function showStatus(kind, text) {
  statusEl.hidden = false
  statusEl.className = 'status ' + (kind || '')
  statusEl.textContent = text
}
function hideStatus() { statusEl.hidden = true; statusEl.textContent = '' }

function setBusy(busy) {
  button.disabled = busy
  urlInput.disabled = busy
  button.textContent = busy ? 'Extracting…' : 'Extract'
}

function textOrEmpty(v) {
  if (v === null || v === undefined || v === '') {
    const dd = document.createElement('dd')
    dd.className = 'empty'
    dd.textContent = '—'
    return dd
  }
  const dd = document.createElement('dd')
  dd.textContent = String(v)
  return dd
}

function finishesNode(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    const dd = document.createElement('dd')
    dd.className = 'empty'
    dd.textContent = '—'
    return dd
  }
  const dd = document.createElement('dd')
  const ul = document.createElement('ul')
  ul.className = 'finishes'
  for (const f of arr) {
    const li = document.createElement('li')
    li.textContent = f
    ul.appendChild(li)
  }
  dd.appendChild(ul)
  return dd
}

function dimensionsNode(obj) {
  if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) {
    const dd = document.createElement('dd')
    dd.className = 'empty'
    dd.textContent = '—'
    return dd
  }
  const dd = document.createElement('dd')
  const dl = document.createElement('dl')
  dl.className = 'dim-table'
  for (const [k, v] of Object.entries(obj)) {
    const dt = document.createElement('dt')
    dt.textContent = k.replace(/_/g, ' ')
    const dd2 = document.createElement('dd')
    dd2.textContent = String(v)
    dl.appendChild(dt); dl.appendChild(dd2)
  }
  dd.appendChild(dl)
  return dd
}

function appendRow(label, valueNode) {
  const dt = document.createElement('dt')
  dt.textContent = label
  fieldsEl.appendChild(dt)
  fieldsEl.appendChild(valueNode)
}

function renderResult(response) {
  const entry = response.entry || {}
  const data  = entry.extractedData || {}
  const metrics = response.metrics || null

  // Header — path + timing
  const pathLabel = metrics ? metrics.path : (entry.status === 'failed' ? 'failed' : 'cache')
  pathEl.textContent = pathLabel
  const timing = []
  if (typeof response.wallMs === 'number') timing.push(`wall ${response.wallMs}ms`)
  if (metrics && typeof metrics.fetchDurationMs === 'number') timing.push(`fetch ${metrics.fetchDurationMs}ms`)
  if (metrics && typeof metrics.claudeDurationMs === 'number' && metrics.claudeDurationMs !== null) {
    timing.push(`claude ${metrics.claudeDurationMs}ms`)
  }
  if (response.source === 'cache') timing.unshift('cached')
  timingEl.textContent = timing.join(' · ')

  // Image (the important bit — render as <img>)
  if (data.image_url) {
    imgEl.src = data.image_url
    imgEl.alt = data.product_name || 'product image'
    imgCaptionEl.textContent = new URL(data.image_url).hostname
  } else {
    imgEl.removeAttribute('src')
    imgEl.alt = 'no image'
    imgCaptionEl.textContent = 'no image_url extracted'
  }

  // Fields
  fieldsEl.innerHTML = ''
  appendRow('Product', textOrEmpty(data.product_name))
  appendRow('Brand', textOrEmpty(data.brand))
  appendRow('Collection', textOrEmpty(data.collection))
  appendRow('SKU', textOrEmpty(data.sku))
  appendRow('Finishes', finishesNode(data.finishes))
  appendRow('Dimensions', dimensionsNode(data.dimensions))
  const urlDd = document.createElement('dd')
  if (entry.url) {
    const a = document.createElement('a')
    a.href = entry.url; a.target = '_blank'; a.rel = 'noopener'
    a.textContent = entry.url
    urlDd.appendChild(a)
  } else {
    urlDd.className = 'empty'
    urlDd.textContent = '—'
  }
  appendRow('URL', urlDd)

  // Raw
  rawJsonEl.textContent = JSON.stringify(response, null, 2)

  resultEl.hidden = false
}

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const url = urlInput.value.trim()
  if (!url) return
  hideStatus()
  resultEl.hidden = true
  setBusy(true)
  showStatus('', 'Extracting… (first-shot Shopify ≈ 1–2s; Claude + rendered paths up to 60s)')

  try {
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const body = await res.json().catch(() => ({ error: 'non-JSON server response' }))
    if (!res.ok) {
      showStatus('err', `Error ${res.status}: ${body.error ?? 'unknown'}`)
      return
    }
    if (body?.entry?.status === 'failed') {
      showStatus('err', `Scrape failed: ${body.entry.errorMessage ?? 'unknown error'}`)
      // Still render the raw response so the user can debug.
      renderResult(body)
      return
    }
    hideStatus()
    renderResult(body)
  } catch (err) {
    showStatus('err', 'Request failed: ' + (err?.message ?? err))
  } finally {
    setBusy(false)
  }
})

// Prefill from ?url= query so it's easy to share debugging links.
const qp = new URLSearchParams(location.search).get('url')
if (qp) { urlInput.value = qp; form.requestSubmit() }
