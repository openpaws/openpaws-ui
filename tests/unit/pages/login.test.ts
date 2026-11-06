import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { useAuthStore } from '~/stores/auth'
import Login from '~/pages/login.vue'
import Register from '~/pages/register.vue'
import VerifyEmail from '~/pages/verify-email.vue'
import { json, ME, mockFetch } from '../../helpers/mockFetch'

const { navigateToMock, reloadMock } = vi.hoisted(() => ({ navigateToMock: vi.fn(), reloadMock: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateToMock)
mockNuxtImport('reloadNuxtApp', () => reloadMock)

async function fillLogin(w: Awaited<ReturnType<typeof mountSuspended>>) {
  await w.get('input[autocomplete="username"]').setValue('kit')
  await w.get('input[autocomplete="current-password"]').setValue('pw')
  await w.get('form').trigger('submit')
  await flushPromises()
}

describe('login page', () => {
  beforeEach(() => {
    navigateToMock.mockReset()
    reloadMock.mockReset()
    useAuthStore().me = null
  })
  const okRoutes = () => ({
    'POST /auth/login': () => json(null, 204),
    'GET /me': () => json({ data: ME }),
  })

  it('login success stores me and fully reloads to next (U9)', async () => {
    mockFetch(okRoutes())
    const w = await mountSuspended(Login, { route: '/login?next=/settings' })
    await fillLogin(w)
    expect(useAuthStore().me?.username).toBe('kit')
    expect(reloadMock).toHaveBeenCalledWith(expect.objectContaining({ path: '/settings', force: true }))
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('rejects open-redirect next=//evil.com', async () => {
    mockFetch(okRoutes())
    const w = await mountSuspended(Login, { route: '/login?next=//evil.com' })
    await fillLogin(w)
    expect(reloadMock).toHaveBeenCalledWith(expect.objectContaining({ path: '/' }))
  })

  it('shows field errors from 422', async () => {
    mockFetch({
      'POST /auth/login': () => json({ error: { code: 'validation_failed', message: 'Invalid.', fields: { login: ['These credentials do not match.'] } } }, 422),
    })
    const w = await mountSuspended(Login, { route: '/login' })
    await fillLogin(w)
    expect(w.text()).toContain('These credentials do not match.')
    const input = w.get('input[autocomplete="username"]')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(w.get(`#${input.attributes('aria-describedby')!.split(' ')[0]}`).text()).toContain('do not match')
    expect(navigateToMock).not.toHaveBeenCalled()
    expect(reloadMock).not.toHaveBeenCalled()
  })

  it('shows the throttle message on 429', async () => {
    mockFetch({ 'POST /auth/login': () => json({ error: { code: 'rate_limited', message: 'Too Many Attempts.' } }, 429) })
    const w = await mountSuspended(Login, { route: '/login' })
    await fillLogin(w)
    expect(w.text()).toContain('Too many attempts — try again in a few minutes.')
  })
})

describe('register page', () => {
  it('submits all fields', async () => {
    const f = mockFetch({ 'POST /auth/register': () => json({ data: ME }, 201) })
    const w = await mountSuspended(Register, { route: '/register' })
    await w.get('input[autocomplete="username"]').setValue('kit')
    await w.get('input[name="display_name"]').setValue('Kit')
    await w.get('input[autocomplete="email"]').setValue('kit@example.com')
    const pws = w.findAll('input[autocomplete="new-password"]')
    await pws[0]!.setValue('secret-pass')
    await pws[1]!.setValue('secret-pass')
    await w.get('form').trigger('submit')
    await flushPromises()
    const call = f.mock.calls.find(([u]) => u.endsWith('/auth/register'))!
    expect(JSON.parse(String(call[1]!.body))).toEqual({
      username: 'kit', display_name: 'Kit', email: 'kit@example.com',
      password: 'secret-pass', password_confirmation: 'secret-pass',
    })
    expect(reloadMock).toHaveBeenCalledWith(expect.objectContaining({ path: '/' }))
  })
})

describe('verify-email page', () => {
  beforeEach(() => { useAuthStore().me = null })

  it('shows success after verifying', async () => {
    mockFetch({ 'POST /auth/email/verify': () => json(null, 204), 'GET /me': () => json({ data: ME }) })
    const w = await mountSuspended(VerifyEmail, { route: '/verify-email?token=abc' })
    await flushPromises()
    expect(w.text()).toContain('Email verified')
  })

  it('shows expired state with Resend when logged in', async () => {
    const f = mockFetch({
      'POST /auth/email/verify': () => json({ error: { code: 'validation_failed', message: 'Bad', fields: { token: ['expired'] } } }, 422),
      'POST /auth/email/resend': () => json(null, 204),
    })
    useAuthStore().me = ME as never
    const w = await mountSuspended(VerifyEmail, { route: '/verify-email?token=abc' })
    await flushPromises()
    expect(w.text()).toContain('expired or invalid')
    const btn = w.get('button')
    expect(btn.text()).toContain('Resend')
    await btn.trigger('click')
    await flushPromises()
    expect(f.mock.calls.some(([u]) => u.endsWith('/auth/email/resend'))).toBe(true)
  })

  it('shows 429 message when resend is throttled', async () => {
    mockFetch({
      'POST /auth/email/verify': () => json({ error: { code: 'validation_failed', message: 'Bad', fields: { token: ['expired'] } } }, 422),
      'POST /auth/email/resend': () => json({ error: { code: 'rate_limited', message: 'x' } }, 429),
    })
    useAuthStore().me = ME as never
    const w = await mountSuspended(VerifyEmail, { route: '/verify-email?token=abc' })
    await flushPromises()
    await w.get('button').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Too many attempts — try again in a few minutes.')
  })

  it('without login, asks to log in instead of showing Resend', async () => {
    mockFetch({ 'POST /auth/email/verify': () => json({ error: { code: 'validation_failed', message: 'Bad', fields: { token: ['expired'] } } }, 422) })
    const w = await mountSuspended(VerifyEmail, { route: '/verify-email?token=abc' })
    await flushPromises()
    expect(w.find('button').exists()).toBe(false)
    expect(w.text()).toContain('Log in')
  })
})
