import type { Ref } from 'vue'

/**
 * Cursor-paginated list over `{ data, meta: { next_cursor } }` endpoints (browse, search,
 * user submissions, tag pages). The cursor is opaque. Top-level fields other than data/meta
 * of the first page (e.g. `tag` on GET /tags/{slug}) are exposed as `extra`.
 * Resets and reloads when `query` changes.
 */
export function useCursorList<T>(path: MaybeRefOrGetter<string>, query: Ref<Record<string, unknown>>, opts: { key?: string } = {}) {
  const api = useApi()
  // With `key`, list state lives in Nuxt state so an SSR-loaded first page survives hydration.
  const items = (opts.key ? useState<T[]>(`${opts.key}:items`, () => []) : ref<T[]>([])) as Ref<T[]>
  const loading = ref(false)
  const done = opts.key ? useState<boolean>(`${opts.key}:done`, () => false) : ref(false)
  const error = ref<Error | null>(null)
  const extra = (opts.key ? useState<Record<string, unknown>>(`${opts.key}:extra`, () => ({})) : ref<Record<string, unknown>>({}))
  const cursorState = opts.key ? useState<string | null>(`${opts.key}:cursor`, () => null) : ref<string | null>(null)
  // Shared with the list state: any instance's reset() invalidates every in-flight request.
  const epoch = opts.key ? useState<number>(`${opts.key}:epoch`, () => 0) : ref(0)

  async function loadMore() {
    if (loading.value || done.value) return
    const ep = epoch.value
    const requested = toValue(path)
    const stale = () => epoch.value !== ep || toValue(path) !== requested
    loading.value = true
    error.value = null
    try {
      const cursor = cursorState.value
      const q = cursor ? { ...query.value, cursor } : { ...query.value }
      const res = await api<{ data: T[], meta: { next_cursor: string | null } } & Record<string, unknown>>(requested, { query: q })
      if (stale()) return
      if (cursor === null && items.value.length === 0) {
        const { data: _d, meta: _m, ...rest } = res
        extra.value = rest
      }
      items.value.push(...res.data)
      cursorState.value = res.meta.next_cursor
      done.value = res.meta.next_cursor === null
    }
    catch (e) {
      if (!stale()) error.value = e as Error
    }
    finally {
      if (epoch.value === ep) loading.value = false
    }
  }

  function reset() {
    epoch.value++
    items.value = []
    extra.value = {}
    cursorState.value = null
    done.value = false
    error.value = null
    loading.value = false
  }

  watch(query, () => {
    reset()
    void loadMore()
  }, { deep: true })

  // Keyed state outlives the page; on client navigation start fresh (hydration keeps the SSR page).
  if (opts.key && import.meta.client && !useNuxtApp().isHydrating) reset()

  return { items, loading, done, error, extra, loadMore, reset }
}
