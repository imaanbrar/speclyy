import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ExtractedProduct } from './schema.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(HERE, '..', '.cache')

const SUCCESS_TTL_MS = 90 * 24 * 60 * 60 * 1000   // 90 days
const FAILURE_TTL_MS = 24 * 60 * 60 * 1000        // 1 day — keep retryable

export interface CacheEntry {
  url: string
  urlHash: string
  status: 'success' | 'failed'
  extractedData: ExtractedProduct | null
  errorMessage: string | null
  scrapedAt: string       // ISO
  expiresAt: string       // ISO
  scrapeDurationMs: number
  /** Extraction path — which tier+extractor produced the result. Only set
   *  on successes (e.g. "adapter:amazon", "jsonld", "plain+claude",
   *  "zyte+claude"). Absent on failures. */
  path?: string
  /** Which HTML source fed the extractor. Absent on failures. */
  fetchSource?: 'plain' | 'zyte-http' | 'zyte-browser'
}

export async function readCache(hash: string): Promise<CacheEntry | null> {
  const path = join(CACHE_DIR, `${hash}.json`)
  try {
    const entry = JSON.parse(await readFile(path, 'utf-8')) as CacheEntry
    if (Date.parse(entry.expiresAt) < Date.now()) return null
    return entry
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

export async function writeCache(entry: CacheEntry): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(
    join(CACHE_DIR, `${entry.urlHash}.json`),
    JSON.stringify(entry, null, 2),
    'utf-8',
  )
}

export function successEntry(
  url: string, hash: string, data: ExtractedProduct, durationMs: number,
  path: string, fetchSource: 'plain' | 'zyte-http' | 'zyte-browser',
): CacheEntry {
  const now = Date.now()
  return {
    url, urlHash: hash,
    status: 'success',
    extractedData: data,
    errorMessage: null,
    scrapedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SUCCESS_TTL_MS).toISOString(),
    scrapeDurationMs: durationMs,
    path,
    fetchSource,
  }
}

export function failureEntry(
  url: string, hash: string, message: string, durationMs: number,
): CacheEntry {
  const now = Date.now()
  return {
    url, urlHash: hash,
    status: 'failed',
    extractedData: null,
    errorMessage: message,
    scrapedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + FAILURE_TTL_MS).toISOString(),
    scrapeDurationMs: durationMs,
  }
}
