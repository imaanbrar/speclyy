// Local web UI for the adapter-first scrape pipeline.
//
// Routes:
//   GET  /             → single-URL page (index.html)
//   GET  /batch        → batch page (paste N URLs, run in parallel)
//   POST /api/extract  → JSON { url } → JSON ScrapeResult
// Static assets (*.html / style.css / *.js) live in ../web/.
//
// We use node:http directly to keep the POC zero-dep. If this grows, swap to
// Hono/Fastify — the shape is the same.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'

const POC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// .env.local wins over .env; override:true so stale shell env doesn't mask.
loadEnv({ path: join(POC_ROOT, '.env.local'), override: true })
loadEnv({ path: join(POC_ROOT, '.env'),       override: true })

import { scrape } from './scrape.ts'

const STATIC_DIR = join(POC_ROOT, 'web')
const PORT = Number(process.env.PORT ?? 3000)

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage, maxBytes = 64 * 1024): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buf = chunk as Buffer
    size += buf.length
    if (size > maxBytes) throw new Error(`body too large (> ${maxBytes} bytes)`)
    chunks.push(buf)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

async function serveStatic(res: ServerResponse, relPath: string): Promise<void> {
  // Resolve inside STATIC_DIR only — guard against `..` path traversal.
  const abs = normalize(join(STATIC_DIR, relPath))
  if (!abs.startsWith(STATIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('Forbidden')
    return
  }
  try {
    const buf = await readFile(abs)
    const type = MIME[extname(abs).toLowerCase()] ?? 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' })
    res.end(buf)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found')
      return
    }
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end(`Error: ${(err as Error).message}`)
  }
}

async function handleExtract(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: string
  try {
    body = await readBody(req)
  } catch (err) {
    return json(res, 413, { error: (err as Error).message })
  }
  let parsed: { url?: unknown; noCache?: unknown }
  try { parsed = JSON.parse(body) } catch {
    return json(res, 400, { error: 'invalid JSON body' })
  }
  const url = parsed.url
  if (typeof url !== 'string' || !url.trim()) {
    return json(res, 400, { error: 'missing or invalid "url" field' })
  }
  try { new URL(url) } catch {
    return json(res, 400, { error: `malformed URL: ${url}` })
  }
  const noCache = parsed.noCache === true

  const started = Date.now()
  try {
    const result = await scrape(url, { noCache })
    const wallMs = Date.now() - started
    console.error(`[web] scraped ${url} → ${result.source} / ${result.entry.status} in ${wallMs}ms${noCache ? ' (noCache)' : ''}`)
    json(res, 200, { ...result, wallMs })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[web] scrape error for ${url}: ${msg}`)
    json(res, 500, { error: msg })
  }
}

const server = createServer(async (req, res) => {
  try {
    const method = req.method ?? 'GET'
    const pathname = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).pathname

    if (method === 'POST' && pathname === '/api/extract') {
      return await handleExtract(req, res)
    }
    if (method === 'GET') {
      if (pathname === '/' || pathname === '/index.html') return await serveStatic(res, 'index.html')
      if (pathname === '/batch' || pathname === '/batch.html') return await serveStatic(res, 'batch.html')
      if (pathname === '/style.css')  return await serveStatic(res, 'style.css')
      if (pathname === '/client.js')  return await serveStatic(res, 'client.js')
      if (pathname === '/batch.js')   return await serveStatic(res, 'batch.js')
      if (pathname === '/favicon.ico') {
        res.writeHead(204); res.end(); return
      }
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[web] unhandled:', msg)
    try {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end(`Server error: ${msg}`)
    } catch { /* response already sent */ }
  }
})

server.listen(PORT, () => {
  console.error(`[web] listening on http://localhost:${PORT}`)
})

const shutdown = (signal: string) => {
  console.error(`[web] ${signal} — shutting down`)
  server.close()
  process.exit(0)
}
process.on('SIGINT',  () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
