import { expect, test } from '@playwright/test'

/**
 * Self-test for the harness. If this file fails, no other spec will run — so
 * keep it small and focused on "does Playwright boot, hit the app, and render".
 */
test('homepage renders the marketing hero', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible()
})
