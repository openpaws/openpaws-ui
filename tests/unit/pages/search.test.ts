import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import Index from '~/pages/index.vue'
import Search from '~/pages/search.vue'
import Tag from '~/pages/tag/[slug].vue'
import { json, mockFetch } from '../../helpers/mockFetch'

const sub = (id: string) => ({ id, type: 'image', title: `T${id}`, rating: 'general', tags: [], user: { username: 'kit', display_name: 'Kit', avatar_url: null }, media: {}, created_at: null })
const page = (ids: string[], extra: object = {}) => json({ data: ids.map(sub), meta: { next_cursor: null }, ...extra })
const query = () => useRouter().currentRoute.value.query
const calls = (f: ReturnType<typeof mockFetch>, p: string) => f.mock.calls.map(c => String(c[0])).filter(u => u.includes(`/api/v1${p}`))

describe('browse/search/tag pages', () => {
  it('changing type updates URL and reloads list', async () => {
    const f = mockFetch({ 'GET /browse': () => page(['1']) })
    const w = await mountSuspended(Index, { route: '/' })
    await flushPromises()
    expect(calls(f, '/browse')).toHaveLength(1)
    await w.get('select[name="type"]').setValue('image')
    await vi.waitFor(() => expect(query().type).toBe('image'))
    await vi.waitFor(() => expect(calls(f, '/browse').at(-1)).toContain('type=image'))
    expect(calls(f, '/browse')).toHaveLength(2)
  })

  it('period selector only for popular sort', async () => {
    mockFetch({ 'GET /browse': () => page(['1']) })
    const w = await mountSuspended(Index, { route: '/' })
    await flushPromises()
    expect(w.find('select[name="period"]').exists()).toBe(false)
    await w.get('select[name="sort"]').setValue('popular')
    await vi.waitFor(() => expect(w.find('select[name="period"]').exists()).toBe(true))
    expect(query().sort).toBe('popular')
    await w.get('select[name="sort"]').setValue('new')
    await vi.waitFor(() => expect(w.find('select[name="period"]').exists()).toBe(false))
  })

  it('search box syntax maps to q, tags, exclude_tags', async () => {
    const f = mockFetch({ 'GET /search': () => page(['1']), 'GET /tags/autocomplete': () => json({ data: [] }) })
    const w = await mountSuspended(Search, { route: '/search' })
    await flushPromises()
    await w.get('input[name="q"]').setValue('fox #wolf -#gore')
    await w.get('form[data-test="search-form"]').trigger('submit')
    await vi.waitFor(() => expect(query()).toMatchObject({ q: 'fox', tags: 'wolf', exclude_tags: 'gore' }))
    await vi.waitFor(() => expect(calls(f, '/search')).toHaveLength(2))
    const u = new URL(calls(f, '/search').at(-1)!)
    expect(u.searchParams.get('q')).toBe('fox')
    expect(u.searchParams.get('tags')).toBe('wolf')
    expect(u.searchParams.get('exclude_tags')).toBe('gore')
  })

  it('search box is prefilled from the URL', async () => {
    mockFetch({ 'GET /search': () => page([]) })
    const w = await mountSuspended(Search, { route: '/search?q=fox&tags=wolf&exclude_tags=gore' })
    await flushPromises()
    expect((w.get('input[name="q"]').element as HTMLInputElement).value).toBe('fox #wolf -#gore')
  })

  it('tag page shows tag usage count', async () => {
    mockFetch({ 'GET /tags/wolf': () => page(['1'], { tag: { slug: 'wolf', usage_count: 42 } }) })
    const w = await mountSuspended(Tag, { route: '/tag/wolf' })
    await flushPromises()
    expect(w.text()).toContain('#wolf')
    expect(w.text()).toContain('42')
  })

  it('tag page 404 renders not-found', async () => {
    mockFetch({ 'GET /tags/nope': () => json({ error: { code: 'not_found', message: 'x' } }, 404) })
    const w = await mountSuspended(Tag, { route: '/tag/nope' })
    await flushPromises()
    expect(w.text()).toContain('Not found')
    expect(w.find('ul.grid').exists()).toBe(false)
    clearError()
  })

  it('search with popular sort has no period control or param', async () => {
    mockFetch({ 'GET /search': () => page(['1']) })
    const w = await mountSuspended(Search, { route: '/search?sort=popular' })
    await flushPromises()
    expect(w.find('select[name="period"]').exists()).toBe(false)
    await w.get('select[name="type"]').setValue('image')
    await vi.waitFor(() => expect(query().type).toBe('image'))
    expect(query().sort).toBe('popular')
    expect(query().period).toBeUndefined()
  })

  it('tag page follows slug changes within the same mounted page', async () => {
    mockFetch({
      'GET /tags/wolf': () => page(['1'], { tag: { slug: 'wolf', usage_count: 1 } }),
      'GET /tags/fox': () => page(['2', '3'], { tag: { slug: 'fox', usage_count: 7 } }),
    })
    const w = await mountSuspended(Tag, { route: '/tag/wolf' })
    await flushPromises()
    expect(w.text()).toContain('#wolf')
    await useRouter().push('/tag/fox')
    await vi.waitFor(() => expect(w.text()).toContain('#fox'))
    await vi.waitFor(() => expect(w.text()).toContain('7'))
    expect(w.text()).not.toContain('#wolf')
    expect(w.text()).toContain('T2')
    expect(w.text()).toContain('T3')
    expect(w.text()).not.toContain('T1')
  })
})
