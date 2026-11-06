import { expect, test } from '@playwright/test'
import { newAdultUser, saveUser, TAG, uploadImage } from './helpers'

test('register, verify, confirm 18+, upload a General image; it appears on / and in search', async ({ page, context }) => {
  const username = await newAdultUser(page)
  await saveUser(username, context) // reused by the adult-gating and layout specs

  const title = `E2E Sunrise ${Date.now()}`
  const id = await uploadImage(page, { title, rating: 'general' })

  await expect(page).toHaveURL(new RegExp(`/view/${id}$`))
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  await expect(page.getByRole('link', { name: `#${TAG}` })).toBeVisible()

  await page.goto('/')
  await expect(page.locator(`a[href="/view/${id}"]`).first()).toBeVisible()

  // Indexing is asynchronous (queue worker): poll with backoff.
  const found = page.locator(`a[href="/view/${id}"]`).first()
  await expect(async () => {
    await page.goto(`/search?q=${encodeURIComponent(title)}`)
    await expect(found).toBeVisible({ timeout: 2_000 })
  }).toPass({ intervals: [1_000, 2_000, 3_000, 5_000], timeout: 40_000 })
})
