import { expect, test } from '@playwright/test'
import { AUTH_FILE, savedUsername, uploadImage } from './helpers'

test.use({ viewport: { width: 360, height: 740 }, storageState: AUTH_FILE })

test('no horizontal overflow at 360px on /, /view/{id} (150-char title) and /user/{u}', async ({ page }) => {
  const title = 'W'.repeat(150)
  const id = await uploadImage(page, { title, rating: 'general' })

  for (const path of ['/', `/view/${id}`, `/user/${savedUsername()}`]) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(width, `scrollWidth on ${path}`).toBeLessThanOrEqual(360)
  }
})
