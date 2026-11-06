import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { useAuthStore } from '~/stores/auth'
import ProfileImageField from '~/components/settings/ProfileImageField.vue'
import { bodyOf, json, ME, mockFetch } from '../helpers/mockFetch'
import { installFakeXhr } from '../helpers/fakeXhr'

const routes = (getMe: () => Response) => ({
  'POST /uploads': () => json({ data: { id: 'a1', kind: 'avatar', status: 'pending', multipart: false, url: 'https://s3/a1', expires_at: 'x' } }, 201),
  'POST /uploads/a1/complete': () => json({ id: 'a1', status: 'uploaded' }),
  'PUT /me/avatar': () => json({ data: { ...ME, avatar_url: null } }, 202),
  'GET /me': getMe,
})

async function pick(w: VueWrapper) {
  const input = w.get('input[type="file"][name="avatar"]')
  Object.defineProperty(input.element, 'files', { value: [new File(['png'], 'me.png', { type: 'image/png' })], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

describe('ProfileImageField (avatar/banner)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    installFakeXhr()
    useAuthStore().me = { ...ME, avatar_url: null, banner_url: null } as never
  })

  it('uploads, sets the avatar, polls /me until the URL changes and shows it', async () => {
    let calls = 0
    const f = mockFetch(routes(() => json({ data: { ...ME, avatar_url: ++calls >= 3 ? 'https://cdn/new.png' : null } })))
    const w = await mountSuspended(ProfileImageField, { props: { kind: 'avatar', interval: 5, timeout: 200 } })
    await pick(w)
    await vi.waitFor(() => expect(bodyOf(f, 'PUT /me/avatar')).toEqual({ upload_session_id: 'a1' }))
    await vi.waitFor(() => expect(w.find('img[src="https://cdn/new.png"]').exists()).toBe(true))
    expect(calls).toBe(3)
    expect(useAuthStore().me?.avatar_url).toBe('https://cdn/new.png')
    expect(w.text()).not.toContain('Still processing')
    w.unmount()
  })

  it('gives up after the timeout with a refresh-later notice', async () => {
    let calls = 0
    mockFetch(routes(() => { calls++; return json({ data: { ...ME, avatar_url: null } }) }))
    const w = await mountSuspended(ProfileImageField, { props: { kind: 'avatar', interval: 5, timeout: 30 } })
    await pick(w)
    await vi.waitFor(() => expect(w.text()).toContain('Still processing — refresh later.'))
    expect(calls).toBe(6)
    expect(useAuthStore().me?.avatar_url).toBeNull()
    w.unmount()
  })
})
