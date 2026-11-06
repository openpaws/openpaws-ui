import { describe, it, expect, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { useAuthStore } from '~/stores/auth'
import Profile from '~/pages/user/[username]/index.vue'
import Gallery from '~/pages/user/[username]/gallery.vue'
import Scraps from '~/pages/user/[username]/scraps.vue'
import FolderPage from '~/pages/user/[username]/folder/[id].vue'
import { json, ME, mockFetch } from '../../helpers/mockFetch'
import { sub } from '../../helpers/submission'

const user = (username: string, extra = {}) => ({ username, display_name: username.toUpperCase(), avatar_url: null, banner_url: null, created_at: null, ...extra })
const profile = (over = {}) => ({ bio: 'x', bio_html: '<p>Hi <b>there</b></p>', links: [{ label: 'Site', url: 'https://a.example' }], species: 'fox', pronouns: 'he/him', pinned: [sub({ id: 'p1', title: 'Pinned one' })], ...over })
const folders = [
  { id: 'g1', name: 'Gallery', description: null, kind: 'gallery', position: 0, count: 1 },
  { id: 's1', name: 'Scraps', description: null, kind: 'scraps', position: 1, count: 0 },
  { id: 'c1', name: 'Fox', description: null, kind: 'custom', position: 2, count: 1 },
]
const list = (titles: string[]) => json({ data: titles.map((t, i) => sub({ id: `${t}${i}`, title: t })), meta: { next_cursor: null } })
const routes = (name: string) => ({
  [`GET /users/${name}`]: () => json({ user: user(name), profile: profile() }),
  [`GET /users/${name}/folders`]: () => json({ data: folders }),
  [`GET /users/${name}/submissions?folder=gallery`]: () => list([`${name}-art`]),
  [`GET /users/${name}/submissions?folder=c1`]: () => list([`${name}-fox`]),
})

describe('user pages', () => {
  beforeEach(() => { useAuthStore().me = null })

  it('profile renders header, links, pinned and latest gallery', async () => {
    mockFetch(routes('kit'))
    const w = await mountSuspended(Profile, { route: '/user/kit' })
    await flushPromises()
    expect(w.text()).toContain('KIT')
    expect(w.text()).toContain('@kit')
    expect(w.text()).toContain('fox')
    expect(w.html()).toContain('<b>there</b>')
    const a = w.get('a[href="https://a.example"]')
    expect(a.attributes('rel')).toBe('nofollow ugc noopener')
    expect(a.attributes('target')).toBe('_blank')
    expect(w.text()).toContain('Pinned one')
    expect(w.text()).toContain('kit-art')
    expect(w.find('a[href="/user/kit/gallery"]').exists()).toBe(true)
  })

  it('unknown user shows not found', async () => {
    mockFetch({})
    const w = await mountSuspended(Profile, { route: '/user/ghost' })
    await flushPromises()
    expect(w.text()).toContain('Not found')
  })

  it('non-owner sees no FolderManager; owner does', async () => {
    mockFetch(routes('kit'))
    const w = await mountSuspended(Gallery, { route: '/user/kit/gallery' })
    await flushPromises()
    expect(w.text()).toContain('kit-art')
    expect(w.find('[data-test="folder-manager"]').exists()).toBe(false)
    useAuthStore().me = { ...ME, username: 'kit' } as never
    const w2 = await mountSuspended(Gallery, { route: '/user/kit/gallery' })
    await flushPromises()
    expect(w2.find('[data-test="folder-manager"]').exists()).toBe(true)
  })

  it('unknown folder shows not found', async () => {
    mockFetch({ ...routes('kit'), 'GET /users/kit/submissions?folder=zzz': () => json({ error: { code: 'not_found', message: 'n' } }, 404) })
    const w = await mountSuspended(FolderPage, { route: '/user/kit/folder/zzz' })
    await flushPromises()
    expect(w.text()).toContain('Not found')
  })

  it('custom folder page lists its items', async () => {
    mockFetch(routes('kit'))
    const w = await mountSuspended(FolderPage, { route: '/user/kit/folder/c1' })
    await flushPromises()
    expect(w.text()).toContain('kit-fox')
  })

  it('navigating between two users shows the second user data', async () => {
    mockFetch({ ...routes('kit'), ...routes('rex') })
    const w = await mountSuspended(Gallery, { route: '/user/kit/gallery' })
    await flushPromises()
    expect(w.text()).toContain('kit-art')
    await useRouter().push('/user/rex/gallery')
    await flushPromises()
    await new Promise(r => setTimeout(r, 20))
    await flushPromises()
    expect(w.text()).toContain('rex-art')
    expect(w.text()).toContain('REX')
    expect(w.text()).not.toContain('kit-art')
  })

  describe('non-404 failures (I2)', () => {
    const boom = () => new Response(JSON.stringify({ error: { code: 'server_error', message: 'boom' } }), { status: 500, headers: { 'content-type': 'application/json', 'x-request-id': 'req-500' } })
    beforeEach(() => clearError())

    it.each([
      ['profile', Profile, '/user/kit'],
      ['gallery', Gallery, '/user/kit/gallery'],
      ['scraps', Scraps, '/user/kit/scraps'],
      ['folder', FolderPage, '/user/kit/folder/c1'],
    ])('%s page: profile 500 shows "Something went wrong" with the request id', async (_n, page, route) => {
      mockFetch({ ...routes('kit'), 'GET /users/kit': boom })
      await mountSuspended(page as never, { route })
      await flushPromises()
      const err = useError().value as { statusCode: number, statusMessage: string, data?: { requestId?: string } }
      expect(err).toBeTruthy()
      expect(err.statusCode).toBe(500)
      expect(err.statusMessage).toBe('Something went wrong')
      expect(err.data?.requestId).toBe('req-500')
    })

    it('folders 500 is also a page error (no header-less page with empty nav)', async () => {
      mockFetch({ ...routes('kit'), 'GET /users/kit/folders': boom })
      await mountSuspended(Gallery, { route: '/user/kit/gallery' })
      await flushPromises()
      expect((useError().value as { statusCode: number } | undefined)?.statusCode).toBe(500)
    })

    it('a 429 maps to "Something went wrong", not Not found', async () => {
      mockFetch({ ...routes('zed'), 'GET /users/zed': () => json({ error: { code: 'rate_limited', message: 'x' } }, 429) })
      await mountSuspended(Profile, { route: '/user/zed' })
      await flushPromises()
      const err = useError().value as { statusCode: number, statusMessage: string }
      expect(err.statusCode).toBe(429)
      expect(err.statusMessage).toBe('Something went wrong')
    })

    it('folder list 500 shows an inline error with Retry that reloads', async () => {
      let fail = true
      mockFetch({
        ...routes('kit'),
        'GET /users/kit/submissions?folder=c1': () => (fail ? boom() : list(['kit-fox'])),
      })
      const w = await mountSuspended(FolderPage, { route: '/user/kit/folder/c1' })
      await flushPromises()
      expect(w.text()).toContain('KIT')
      expect(w.get('[role="alert"]').text()).toContain('Something went wrong')
      fail = false
      await w.get('[role="alert"] button').trigger('click')
      await flushPromises()
      expect(w.find('[role="alert"]').exists()).toBe(false)
      expect(w.text()).toContain('kit-fox')
      expect(useError().value).toBeFalsy()
    })
  })
})
