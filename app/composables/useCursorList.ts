import type { Ref } from 'vue'

/**
 * Cursor-paginated list over `{ data, meta: { next_cursor } }` endpoints (browse, search,
 * user submissions, tag pages). The cursor is opaque. Top-level fields other than data/meta
 * of the first page (e.g. `tag` on GET /tags/{slug}) are exposed as `extra`.
 * Resets and reloads when `query` changes.
 */
export function useCursorList<T>(path: string, query: Ref<Record<string, unknown>>) {
  const api = useApi()
  const items = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const done = ref(false)
  const error = ref<Error | null>(null)
  const extra = ref<Record<string, unknown>>({})
  let cursor: string | null = null
  let generation = 0

  async function loadMore() {
    if (loading.value || done.value) return
    const gen = generation
    loading.value = true
    error.value = null
    try {
      const q = cursor ? { ...query.value, cursor } : { ...query.value }
      const res = await api<{ data: T[], meta: { next_cursor: string | null } } & Record<string, unknown>>(path, { query: q })
      if (gen !== generation) return
      if (cursor === null && items.value.length === 0) {
        const { data: _d, meta: _m, ...rest } = res
        extra.value = rest
      }
      items.value.push(...res.data)
      cursor = res.meta.next_cursor
      done.value = cursor === null
    }
    catch (e) {
      if (gen === generation) error.value = e as Error
    }
    finally {
      if (gen === generation) loading.value = false
    }
  }

  function reset() {
    generation++
    items.value = []
    extra.value = {}
    cursor = null
    done.value = false
    error.value = null
    loading.value = false
  }

  watch(query, () => {
    reset()
    void loadMore()
  }, { deep: true })

  return { items, loading, done, error, extra, loadMore, reset }
}
