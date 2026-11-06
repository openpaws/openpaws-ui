import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { expect, type BrowserContext, type Page } from '@playwright/test'

export const API_DIR = path.resolve(process.env.OPENPAWS_API_DIR ?? '../openpaws-api')
export const FIXTURE = path.join(API_DIR, 'tests/Fixtures/media/image.png')
export const PASSWORD = 'Passw0rd!xyz-e2e'
export const AUTH_FILE = path.resolve('tests/e2e/.auth/user.json')
export const USER_FILE = path.resolve('tests/e2e/.auth/username.txt')
export const TAG = 'e2etest'

let seq = 0
/** Unique per run and per call; the e2e_ prefix is what global teardown cleans up. */
export function uniqueUsername(): string {
  return `e2e_${Date.now().toString(36)}${seq++}`
}

export function verifyEmail(username: string, adult = false) {
  execFileSync('php', ['artisan', 'openpaws:test-verify', username, ...(adult ? ['--adult'] : [])], { cwd: API_DIR, stdio: 'pipe' })
}

/** Nuxt SSRs the page; interacting before hydration loses input, so wait for the network to settle. */
export async function open(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
}

export function saveUser(username: string, context: BrowserContext) {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })
  fs.writeFileSync(USER_FILE, username)
  return context.storageState({ path: AUTH_FILE })
}

export function savedUsername(): string {
  return fs.readFileSync(USER_FILE, 'utf8').trim()
}

export async function register(page: Page, username: string) {
  await open(page, '/register')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Display name').fill(`E2E ${username}`)
  await page.getByLabel('Email', { exact: true }).fill(`${username}@example.test`)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('link', { name: 'Upload' })).toBeVisible()
}

/** Settings: confirm 18+, then set the content filter to Adult. */
export async function confirmAdultInSettings(page: Page) {
  await open(page, '/settings')
  await page.getByLabel('I confirm I am 18 years of age or older').check()
  await page.locator('[data-test=confirm-adult]').click()
  const form = page.locator('[data-test=rating-form]')
  await form.getByLabel('Adult').check()
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Content filter saved.')).toBeVisible()
}

/** Register, verify the email through the API helper and reload, confirm 18+ and show Adult content. */
export async function newAdultUser(page: Page): Promise<string> {
  const username = uniqueUsername()
  await register(page, username)
  verifyEmail(username)
  await confirmAdultInSettings(page)
  return username
}

export async function uploadImage(page: Page, opts: { title: string, rating: 'general' | 'mature' | 'adult', tags?: string[] }): Promise<string> {
  await open(page, '/upload')
  await page.getByLabel('Image', { exact: true }).check()
  await page.locator('input[type=file][name=file]').setInputFiles(FIXTURE)
  await expect(page.getByText('Uploaded image.png')).toBeVisible()
  await page.locator('[data-test=next]').click()
  await page.getByLabel('Title').fill(opts.title)
  await page.locator(`input[name=rating][value=${opts.rating}]`).check()
  for (const tag of opts.tags ?? [TAG]) {
    await page.getByLabel('Tags').fill(tag)
    await page.getByLabel('Tags').press('Enter')
  }
  await page.getByRole('button', { name: 'Publish' }).click()
  await page.waitForURL(/\/view\/[^/]+$/, { timeout: 90_000 })
  return new URL(page.url()).pathname.split('/').pop()!
}
