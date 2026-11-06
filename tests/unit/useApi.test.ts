import { describe, it, expect, vi } from 'vitest'
import { useApi } from '~/composables/useApi'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useRuntimeConfig } from '#imports'

mockNuxtImport('useRequestHeaders', () => () => ({ cookie: 'laravel_session=abc' }))

describe('useApi', () => {
  it('uses runtime config base and /api/v1 prefix', async () => {
    const fetchMock = vi.fn(async () => new Response('{"data":{"ok":true}}', { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const api = useApi()
    expect(await api('/me')).toEqual({ data: { ok: true } })
    const url = (fetchMock.mock.calls[0] as unknown as [string])[0]
    expect(url).toBe(`${useRuntimeConfig().public.apiBase}/api/v1/me`)
    vi.unstubAllGlobals()
  })
})
