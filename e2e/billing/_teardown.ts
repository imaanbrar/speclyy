/**
 * Playwright global teardown for the billing-flow specs.
 *
 *   1. Kill `stripe listen` if its pid is still alive.
 *   2. Restore the pre-run `apps/web/.env.local` from the backup.
 *
 * Runs even on Ctrl-C and on test failures (Playwright invokes
 * `globalTeardown` in a finally-equivalent position).
 */

import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs'

import { DEV_PID_FILE, ENV_BACKUP, ENV_FILE, STORAGE_STATE, STRIPE_PID_FILE } from './_setup'

function killByPidFile(label: string, file: string): void {
  if (!existsSync(file)) return
  const pid = Number(readFileSync(file, 'utf8').trim())
  if (Number.isFinite(pid) && pid > 0) {
    try {
      process.kill(pid, 'SIGTERM')
      console.log(`[e2e/teardown]   ✓ Killed ${label} (pid ${pid})`)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ESRCH') {
        console.warn(`[e2e/teardown]   ! kill ${label} ${pid} failed:`, err)
      }
    }
  }
  rmSync(file, { force: true })
}

export default async function globalTeardown(): Promise<void> {
  console.log('[e2e/teardown] Cleaning up…')

  killByPidFile('stripe listen', STRIPE_PID_FILE)
  killByPidFile('dev server', DEV_PID_FILE)

  // Restore env. Move (not copy) so the backup is gone afterwards —
  // presence of the backup is the "in-progress" signal.
  if (existsSync(ENV_BACKUP)) {
    renameSync(ENV_BACKUP, ENV_FILE)
    console.log(`[e2e/teardown]   ✓ Restored ${ENV_FILE} from backup`)
  }

  if (existsSync(STORAGE_STATE)) {
    console.log(`[e2e/teardown]   • Storage state preserved at ${STORAGE_STATE}`)
  }

  console.log('[e2e/teardown] Done.')
}
