import { expect, test } from '@playwright/test'
import { AUTH_FILE, open, PASSWORD, savedUsername, TAG, uploadImage } from './helpers'

test.use({ storageState: AUTH_FILE }) // the user registered by signup-upload

test('an Adult submission is visible to its owner on a full page load, hidden from guests', async ({ page, browser, baseURL }) => {
  const stamp = Date.now()
  const title = `E2E Adult ${stamp}`
  const id = await uploadImage(page, { title, rating: 'adult' })
  // Positive control for the guest tag page: a General submission with the same tag.
  const generalTitle = `E2E General ${stamp}`
  const generalId = await uploadImage(page, { title: generalTitle, rating: 'general' })

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
    await expect(gp.locator(`a[href="/view/${generalId}"]`).first()).toBeVisible()
    await expect(gp.locator(`a[href="/view/${id}"]`)).toHaveCount(0)
  }
  finally {
    await guest.close()
  }
})

test('logging out on / removes Adult cards; the guest home page never shows them (I1)', async ({ browser, baseURL }) => {
  // A separate session (logging out must not end the shared one in AUTH_FILE).
  const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
  try {
    const page = await ctx.newPage()
    const id = await (async () => {
      await open(page, '/login')
      await page.getByLabel('Username or email').fill(savedUsername())
      await page.getByLabel('Password').fill(PASSWORD)
      await page.getByRole('button', { name: 'Log in' }).click()
      await expect(page.getByRole('link', { name: 'Upload' })).toBeVisible()
      return uploadImage(page, { title: `E2E Logout ${Date.now()}`, rating: 'adult' })
    })()

    await open(page, '/')
    const adultCard = page.locator(`a[href="/view/${id}"]`)
    await expect(adultCard.first()).toBeVisible()

    await page.getByRole('button', { name: /E2E / }).click()
    await page.getByRole('menuitem', { name: 'Log out' }).click()
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/$/)
    await expect(adultCard).toHaveCount(0)
  }
  finally {
    await ctx.close()
  }
})
