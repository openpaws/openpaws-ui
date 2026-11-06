import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref, nextTick } from 'vue'
import { useCursorList } from '~/composables/useCursorList'

const api = vi.fn()
mockNuxtImport('useApi', () => () => api)

const page = (data: unknown[], next: string | null, extra: object = {}) => ({ data, meta: { next_cursor: next }, ...extra })

describe('useCursorList', () => {
  beforeEach(() => api.mockReset())

  it('appends pages and stops when next_cursor is null; resets on query change', async () => {
    api.mockResolvedValueOnce(page([1, 2], 'c1', { tag: { slug: 't' } }))
      .mockResolvedValueOnce(page([3], null))
    const query = ref<Record<string, unknown>>({ q: 'a' })
    const list = useCursorList<number>('/search', query)
    await list.loadMore()
    expect(list.items.value).toEqual([1, 2])
    expect(list.done.value).toBe(false)
    expect(list.extra.value).toEqual({ tag: { slug: 't' } })
    await list.loadMore()
    expect(api.mock.calls[1]![1]).toEqual({ query: { q: 'a', cursor: 'c1' } })
    expect(list.items.value).toEqual([1, 2, 3])
    expect(list.done.value).toBe(true)
    await list.loadMore()
    expect(api).toHaveBeenCalledTimes(2)

    api.mockResolvedValueOnce(page([9], null))
    query.value = { q: 'b' }
    await nextTick()
    await vi.waitFor(() => expect(list.items.value).toEqual([9]))
    expect(api.mock.calls[2]![1]).toEqual({ query: { q: 'b' } })
  })

  it('captures errors', async () => {
    api.mockRejectedValueOnce(new Error('x'))
    const list = useCursorList<number>('/browse', ref({}))
    await list.loadMore()
    expect(list.error.value).toBeInstanceOf(Error)
    expect(list.loading.value).toBe(false)
  })
})
