import { config as loadEnv } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const POC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// override: true — .env.local wins even if the shell has an empty or stale
// ANTHROPIC_API_KEY exported (dotenv's default is not to overwrite).
loadEnv({ path: join(POC_ROOT, '.env.local'), override: true })
loadEnv({ path: join(POC_ROOT, '.env'), override: true })

import { scrape } from './scrape.ts'

async function main() {
  const urls = process.argv.slice(2)
  if (urls.length === 0) {
    console.error('Usage: pnpm scrape <url> [<url> ...]')
    process.exit(2)
  }

  for (const url of urls) {
    try { new URL(url) } catch {
      console.error(`Invalid URL: ${url}`)
      process.exit(2)
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and fill it in.')
    process.exit(2)
  }

  let anyFailed = false
  for (const url of urls) {
    const started = Date.now()
    const result = await scrape(url)
    const wallMs = Date.now() - started
    console.error(`[scrape] ${url} → ${result.source} in ${wallMs}ms`)
    console.log(JSON.stringify(result, null, 2))
    if (result.entry.status === 'failed') anyFailed = true
  }

  if (anyFailed) process.exitCode = 1
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err)
  process.exitCode = 1
})
