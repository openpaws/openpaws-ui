import { expect, test } from '@playwright/test'
import { AUTH_FILE, TAG, uploadImage } from './helpers'

test.use({ storageState: AUTH_FILE }) // the user registered by signup-upload

test('an Adult submission is visible to its owner on a full page load, hidden from guests', async ({ page, browser, baseURL }) => {
  const title = `E2E Adult ${Date.now()}`
  const id = await uploadImage(page, { title, rating: 'adult' })

  // Review focus #1: a full (SSR) page load as the owner still shows it.
  await page.goto(`/view/${id}`)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()

  const guest = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } }) // a true guest, not the owner's session
  try {
    const gp = await guest.newPage()
    await gp.goto(`/view/${id}`)
    await expect(gp.getByText('Not found').first()).toBeVisible()
    await expect(gp.getByText(title)).toHaveCount(0)

    await gp.goto(`/tag/${TAG}`)
    await expect(gp.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(gp.locator(`a[href="/view/${id}"]`)).toHaveCount(0)
  }
  finally {
    await guest.close()
  }
})
