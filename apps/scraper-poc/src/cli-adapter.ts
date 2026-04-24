// Standalone test harness for per-vendor adapters.
//
// Usage:
//   pnpm tsx src/cli-adapter.ts --url <url>           # plain-fetch the URL
//   pnpm tsx src/cli-adapter.ts --file <path> --url <url>   # read local HTML
//
// Prints the adapter's extracted data plus a per-field trace showing which
// selector each value came from — so we can see exactly where the pipeline
// is winning or losing without involving Claude, Playwright, or the cache.

import { readFile } from 'node:fs/promises'
import { fetchHtml } from './fetch-html.ts'

interface Args {
  url: string | null
  file: string | null
}

function parseArgs(argv: string[]): Args {
  const out: Args = { url: null, file: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--url' && argv[i + 1]) { out.url = argv[++i]; continue }
    if (a === '--file' && argv[i + 1]) { out.file = argv[++i]; continue }
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.url) {
    console.error('usage: pnpm tsx src/cli-adapter.ts --url <url> [--file <path>]')
    process.exit(2)
  }

  let html: string
  if (args.file) {
    html = await readFile(args.file, 'utf-8')
  } else {
    const r = await fetchHtml(args.url)
    console.error(`[fetch] ${r.status} in ${r.fetchDurationMs}ms  bytes=${r.html.length}`)
    html = r.html
  }
  console.error(`[adapter] html bytes=${html.length}`)

  // Resolve with HTML so platform-sniffing adapters (Shopify) can match.
  const { ADAPTERS } = await import('./adapters/index.ts')
  const adapter = ADAPTERS.find(a => a.matches(args.url!, html))
  if (!adapter) {
    console.error(`[adapter] no adapter for ${args.url}`)
    process.exit(1)
  }
  console.error(`[adapter] resolved: ${adapter.name}`)

  const started = Date.now()
  const result = await adapter.extract(html, args.url!)
  console.error(`[adapter] extracted in ${Date.now() - started}ms`)

  console.log('--- data ---')
  console.log(JSON.stringify(result.data, null, 2))
  console.log('--- trace (field → source) ---')
  console.log(JSON.stringify(result.trace, null, 2))

  const filled = Object.entries(result.data).filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0)).length
  const total = Object.keys(result.data).length
  console.error(`[adapter] ${adapter.name}: ${filled}/${total} fields populated`)
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err)
  process.exit(1)
})
