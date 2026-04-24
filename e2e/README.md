# E2E — Playwright

Minimal Playwright harness. Config lives at the repo root
(`playwright.config.ts`, scripts in `package.json`); specs live here.

```
e2e/
├── smoke.spec.ts   # harness self-test
└── tsconfig.json
```

The auth/onboarding/billing suites were removed until the product is closer
to production — re-add them as groups land. Until then, keep this directory
holding the harness and the smoke test so CI has something to run.

## Running locally

```bash
pnpm install
pnpm test:e2e:install   # one-time: downloads Chromium
pnpm test:e2e           # runs headless
pnpm test:e2e:ui        # interactive
pnpm test:e2e:headed    # show the browser while it runs
```

The `webServer` block in `playwright.config.ts` starts `pnpm --filter
@speclyy/web dev` automatically — you don't need a separate dev terminal.

## CI

`.github/workflows/e2e.yml` runs on PRs that touch `apps/web/**`,
`packages/**`, or `e2e/**`. It installs Chromium and uploads the HTML report
**only on failure** to keep green-build runtime cheap.
