import { describe, it, expect, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import FolderManager from '~/components/user/FolderManager.vue'
import { useToasts } from '~/composables/useToasts'
import type { Folder } from '~/types/api'
import { bodyOf, json, mockFetch } from '../helpers/mockFetch'
import { sub } from '../helpers/submission'

const folders: Folder[] = [
  { id: 'g1', name: 'Gallery', description: null, kind: 'gallery', position: 0, count: 3 },
  { id: 's1', name: 'Scraps', description: null, kind: 'scraps', position: 1, count: 0 },
  { id: 'c1', name: 'Fox', description: null, kind: 'custom', position: 2, count: 1 },
]
const items = [sub({ id: 'a', title: 'Alpha' }), sub({ id: 'b', title: 'Beta' }), sub({ id: 'c', title: 'Gamma' })]

const mountIt = (props: Record<string, unknown> = {}) => mountSuspended(FolderManager, {
  props: { username: 'kit', folders, current: 'g1', items, loading: false, done: true, ...props },
})
const titles = (w: Awaited<ReturnType<typeof mountIt>>) => w.findAll('[data-test="reorder-item"]').map(l => l.attributes('data-id'))

describe('FolderManager', () => {
  beforeEach(() => { useToasts().items.value = [] })

  it('gallery and scraps cannot be renamed or deleted in the UI', async () => {
    const w = await mountIt()
    const rows = w.findAll('[data-test="folder-row"]')
    expect(rows).toHaveLength(3)
    const [g, s, c] = rows
    expect(g!.find('[data-test="rename"]').exists()).toBe(false)
    expect(g!.find('[data-test="delete"]').exists()).toBe(false)
    expect(s!.find('[data-test="rename"]').exists()).toBe(false)
    expect(s!.find('[data-test="delete"]').exists()).toBe(false)
    expect(c!.find('[data-test="rename"]').exists()).toBe(true)
    expect(c!.find('[data-test="delete"]').exists()).toBe(true)
  })

  it('drag and drop reorders; dragstart sets dataTransfer data so Firefox starts the drag', async () => {
    const f = mockFetch({ 'PUT /folders/g1/order': () => json(null, 204) })
    const w = await mountIt()
    const dt = { effectAllowed: 'uninitialized', data: {} as Record<string, string>, setData(t: string, v: string) { this.data[t] = v } }
    await w.get('[data-test="reorder-item"][data-id="a"]').trigger('dragstart', { dataTransfer: dt })
    expect(dt.data['text/plain']).toBe('a')
    expect(dt.effectAllowed).toBe('move')
    await w.get('[data-test="reorder-item"][data-id="c"]').trigger('drop')
    await flushPromises()
    expect(bodyOf(f, 'PUT /folders/g1/order')).toEqual({ submission_ids: ['b', 'c', 'a'] })
  })

  it('reorder sends full id list', async () => {
    const f = mockFetch({ 'PUT /folders/g1/order': () => json(null, 204) })
    const w = await mountIt()
    await w.get('[data-test="reorder-item"][data-id="c"] [data-test="up"]').trigger('click')
    await flushPromises()
    expect(bodyOf(f, 'PUT /folders/g1/order')).toEqual({ submission_ids: ['a', 'c', 'b'] })
    expect(useToasts().items.value.map(t => t.msg)).toContain('Order saved.')
  })

  it('move up/down buttons reorder for keyboard users', async () => {
    const f = mockFetch({ 'PUT /folders/g1/order': () => json(null, 204) })
    const w = await mountIt()
    const up = w.get('[data-test="reorder-item"][data-id="a"] [data-test="up"]')
    expect(up.attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="reorder-item"][data-id="b"] [data-test="down"]').attributes('aria-label')).toContain('Beta')
    await w.get('[data-test="reorder-item"][data-id="a"] [data-test="down"]').trigger('click')
    await flushPromises()
    expect(titles(w)).toEqual(['b', 'a', 'c'])
    expect(bodyOf(f, 'PUT /folders/g1/order')).toEqual({ submission_ids: ['b', 'a', 'c'] })
  })

  it('reorder is disabled until all pages are loaded', async () => {
    const f = mockFetch({ 'PUT /folders/g1/order': () => json(null, 204) })
    const w = await mountIt({ done: false })
    expect(w.text()).toContain('Load all items to reorder')
    expect(w.find('[data-test="up"]').exists()).toBe(false)
    await w.get('[data-test="load-all"]').trigger('click')
    expect(w.emitted('loadAll')).toHaveLength(1)
    expect(f).not.toHaveBeenCalled()
  })

  it('failed reorder restores the previous order and shows the error', async () => {
    mockFetch({ 'PUT /folders/g1/order': () => json({ error: { code: 'invalid_state', message: 'Nope.' } }, 422) })
    const w = await mountIt()
    await w.get('[data-test="reorder-item"][data-id="a"] [data-test="down"]').trigger('click')
    await flushPromises()
    expect(titles(w)).toEqual(['a', 'b', 'c'])
    expect(w.text()).toContain('Nope.')
    const last = (w.emitted('update:items') ?? []).at(-1)![0] as { id: string }[]
    expect(last.map(i => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('creates a folder and shows field errors', async () => {
    const f = mockFetch({ 'POST /folders': () => json({ error: { code: 'validation_failed', message: 'Invalid', fields: { name: ['Taken.'] } } }, 422) })
    const w = await mountIt()
    await w.get('input[name="new_folder"]').setValue('Fox')
    await w.get('form[data-test="create"]').trigger('submit')
    await flushPromises()
    expect(bodyOf(f, 'POST /folders')).toEqual({ name: 'Fox' })
    expect(w.text()).toContain('Taken.')
  })

  it('renames and deletes a custom folder', async () => {
    const f = mockFetch({
      'PATCH /folders/c1': () => json({ data: { ...folders[2], name: 'Wolf' } }),
      'DELETE /folders/c1': () => json(null, 204),
    })
    const w = await mountIt()
    const row = () => w.findAll('[data-test="folder-row"]')[2]!
    await row().get('[data-test="rename"]').trigger('click')
    await row().get('input[name="rename"]').setValue('Wolf')
    await row().get('form[data-test="rename-form"]').trigger('submit')
    await flushPromises()
    expect(bodyOf(f, 'PATCH /folders/c1')).toEqual({ name: 'Wolf' })
    await row().get('[data-test="delete"]').trigger('click')
    expect(f.mock.calls.some(c => (c[1] as RequestInit)?.method === 'DELETE')).toBe(false)
    await row().get('[data-test="confirm-delete"]').trigger('click')
    await flushPromises()
    expect(f.mock.calls.some(c => (c[1] as RequestInit)?.method === 'DELETE')).toBe(true)
    expect(w.emitted('changed')).toHaveLength(2)
  })
})
