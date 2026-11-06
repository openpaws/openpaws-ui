import { describe, it, expect, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import AppHeader from '~/components/AppHeader.vue'
import { useAuthStore } from '~/stores/auth'
import { json, ME, mockFetch } from '../helpers/mockFetch'

const { navigateToMock } = vi.hoisted(() => ({ navigateToMock: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateToMock)

describe('AppHeader', () => {
  it('Log out navigates home even when the API fails', async () => {
    mockFetch({ 'POST /auth/logout': () => json({ error: { code: 'server_error', message: 'boom' } }, 500) })
    const auth = useAuthStore()
    auth.me = ME as never
    const w = await mountSuspended(AppHeader)
    await w.get('button').trigger('click')
    await flushPromises()
    expect(auth.me).toBeNull()
    expect(navigateToMock).toHaveBeenCalledWith('/')
  })
})
