import { expect, test } from '@playwright/test'
import { AUTH_FILE, savedUsername, uploadImage } from './helpers'

test.use({ viewport: { width: 360, height: 740 }, storageState: AUTH_FILE })

test('no horizontal overflow at 360px on /, /view/{id} (150-char title) and /user/{u}', async ({ page }) => {
  const title = 'W'.repeat(150)
  const id = await uploadImage(page, { title, rating: 'general' })
  const username = savedUsername()
  const card = page.locator(`a[href="/view/${id}"]`).first()

  // Positive controls: each page really rendered its content (not an error page) before measuring.
  const checks: [string, () => Promise<void>][] = [
    ['/', () => expect(card).toBeVisible()],
    [`/view/${id}`, () => expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()],
    [`/user/${username}`, async () => {
      await expect(page.getByText(`@${username}`).first()).toBeVisible()
      await expect(card).toBeVisible()
    }],
  ]
  for (const [path, rendered] of checks) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await rendered()
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(width, `scrollWidth on ${path}`).toBeLessThanOrEqual(360)
  }
})
