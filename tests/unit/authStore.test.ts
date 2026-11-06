import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { setActivePinia, createPinia } from 'pinia'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useAuthStore } from '~/stores/auth'
import { createApiClient, setUnauthenticatedHandler } from '~/utils/apiClient'
import { ApiError } from '~/utils/apiError'
import { json, ME, mockFetch, bodyOf } from '../helpers/mockFetch'

const { navigateToMock, routeRef } = vi.hoisted(() => ({
  navigateToMock: vi.fn(),
  routeRef: { value: { fullPath: '/', meta: {} as Record<string, unknown> } },
}))
mockNuxtImport('navigateTo', () => navigateToMock)
mockNuxtImport('useRoute', () => () => routeRef.value)

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    navigateToMock.mockReset()
    routeRef.value = { fullPath: '/', meta: {} }
    setUnauthenticatedHandler(null)
  })

  it('fetchMe stores me and marks loaded; a 401 guest is not an error', async () => {
    mockFetch({ 'GET /me': () => json({ data: ME }) })
    const s = useAuthStore()
    await s.fetchMe()
    expect(s.me?.username).toBe('kit')
    expect(s.loaded).toBe(true)

    mockFetch({ 'GET /me': () => json({ error: { code: 'unauthenticated', message: 'x' } }, 401) })
    const g = useAuthStore()
    await g.fetchMe()
    expect(g.me).toBeNull()
    expect(g.loaded).toBe(true)
  })

  it('login posts credentials then loads me', async () => {
    const f = mockFetch({
      'POST /auth/login': () => json(null, 204),
      'GET /me': () => json({ data: ME }),
    })
    const s = useAuthStore()
    await s.login({ login: 'kit', password: 'pw', remember: true })
    expect(bodyOf(f, 'POST /auth/login')).toEqual({ login: 'kit', password: 'pw', remember: true })
    expect(s.me?.username).toBe('kit')
  })

  it('register posts username, display_name, email, password, confirmation', async () => {
    const f = mockFetch({ 'POST /auth/register': () => json({ data: ME }, 201) })
    const s = useAuthStore()
    const payload = {
      username: 'kit', display_name: 'Kit', email: 'kit@example.com',
      password: 'secret-pass', password_confirmation: 'secret-pass',
    }
    await s.register(payload)
    expect(bodyOf(f, 'POST /auth/register')).toEqual(payload)
    expect(s.me?.username).toBe('kit')
  })

  it('logout clears me', async () => {
    mockFetch({ 'POST /auth/logout': () => json(null, 204) })
    const s = useAuthStore()
    s.me = ME as never
    await s.logout()
    expect(s.me).toBeNull()
  })

  it('401 from any call clears me and redirects to /login?next=current on auth routes', async () => {
    mockFetch({ 'GET /thing': () => json({ error: { code: 'unauthenticated', message: 'x' } }, 401) })
    const s = useAuthStore()
    s.me = ME as never
    routeRef.value = { fullPath: '/settings?tab=a', meta: { middleware: ['auth'] } }
    setUnauthenticatedHandler(() => s.onUnauthenticated())
    const client = createApiClient({
      fetch: (...a) => globalThis.fetch(...a), apiBase: 'http://api.test', siteUrl: 'http://s', isServer: false, getCookie: () => '',
    })
    await expect(client('/thing')).rejects.toBeInstanceOf(ApiError)
    expect(s.me).toBeNull()
    expect(navigateToMock).toHaveBeenCalledWith('/login?next=%2Fsettings%3Ftab%3Da')
  })

  it('onUnauthenticated clears me but does not redirect on public routes', () => {
    const s = useAuthStore()
    s.me = ME as never
    routeRef.value = { fullPath: '/', meta: {} }
    s.onUnauthenticated()
    expect(s.me).toBeNull()
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('only client-only plugins register the unauthenticated handler (SSR never does)', () => {
    const roots = ['app/plugins', 'app/stores', 'app/composables']
    const offenders: string[] = []
    for (const dir of roots) {
      for (const f of readdirSync(join(process.cwd(), dir))) {
        const src = readFileSync(join(process.cwd(), dir, f), 'utf8')
        if (/setUnauthenticatedHandler\(/.test(src) && !(dir === 'app/plugins' && f.endsWith('.client.ts'))) offenders.push(`${dir}/${f}`)
      }
    }
    expect(offenders).toEqual([])
    const client = readdirSync(join(process.cwd(), 'app/plugins')).filter(f => f.endsWith('.client.ts'))
    expect(client.some(f => /setUnauthenticatedHandler\(/.test(readFileSync(join(process.cwd(), 'app/plugins', f), 'utf8')))).toBe(true)
  })
})
