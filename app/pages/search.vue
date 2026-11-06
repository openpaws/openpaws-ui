<script setup lang="ts">
import type { Submission, Tag } from '~/types/api'
import { ApiError } from '~/utils/apiError'

useHead({ title: 'Search — OpenPaws' })
const route = useRoute()
const router = useRouter()
const api = useApi()

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const split = (v: unknown) => str(v).split(',').map(s => s.trim()).filter(Boolean)

const filters = computed(() => {
  const out: Record<string, string> = {}
  for (const k of ['type', 'sort'] as const) if (str(route.query[k])) out[k] = str(route.query[k])
  return out
})
const query = computed(() => {
  const out: Record<string, string> = { ...filters.value }
  for (const k of ['q', 'tags', 'exclude_tags'] as const) if (str(route.query[k])) out[k] = str(route.query[k])
  return out
})
const fromUrl = () => formatSearch({ q: str(route.query.q), tags: split(route.query.tags), exclude_tags: split(route.query.exclude_tags) })
const box = ref(fromUrl())
watch(() => [route.query.q, route.query.tags, route.query.exclude_tags], () => { box.value = fromUrl() })

const list = useCursorList<Submission>('/search', query, { key: 'search' })
if (!list.items.value.length && !list.done.value) await list.loadMore()

const errorMessage = computed(() => {
  const e = list.error.value
  if (!e) return ''
  if (e instanceof ApiError && e.status === 429) return 'Too many attempts — try again in a few minutes.'
  return 'Search failed. Please try again.'
})

function submit() {
  const p = parseSearch(box.value)
  const next: Record<string, string> = { ...filters.value }
  if (p.q) next.q = p.q.slice(0, 200)
  if (p.tags.length) next.tags = p.tags.slice(0, 20).join(',')
  if (p.exclude_tags.length) next.exclude_tags = p.exclude_tags.slice(0, 20).join(',')
  return router.push({ path: '/search', query: next })
}
function updateFilters(f: Record<string, string>) {
  return router.push({ path: '/search', query: { ...route.query, ...{ type: undefined, sort: undefined }, ...f } })
}

// Tag autocomplete for the token being typed (#foo / -#foo).
const suggestions = ref<string[]>([])
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
watch(box, (v) => {
  clearTimeout(timer)
  const m = /(^|\s)(-?#)([^\s#]+)$/.exec(v)
  if (!m) { suggestions.value = []; return }
  const mine = ++seq
  timer = setTimeout(async () => {
    try {
      const res = await api<{ data: Pick<Tag, 'slug'>[] }>('/tags/autocomplete', { query: { q: m[3] } })
      if (mine !== seq) return
      const head = v.slice(0, v.length - m[2]!.length - m[3]!.length)
      suggestions.value = res.data.map(t => `${head}${m[2]}${t.slug}`)
    }
    catch { suggestions.value = [] }
  }, 200)
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <section>
    <h1>Search</h1>
    <form data-test="search-form" role="search" @submit.prevent="submit">
      <input v-model="box" name="q" type="search" maxlength="400" list="tag-suggestions" placeholder="fox #wolf -#gore" aria-label="Search">
      <datalist id="tag-suggestions">
        <option v-for="s in suggestions" :key="s" :value="s" />
      </datalist>
      <button type="submit">Search</button>
    </form>
    <SubmissionBrowseFilters
      :model-value="filters"
      default-sort="relevance"
      :sorts="[{ value: 'relevance', label: 'Relevance' }, { value: 'new', label: 'Newest' }, { value: 'popular', label: 'Popular' }]"
      @update:model-value="updateFilters"
    />
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <SubmissionGrid :items="list.items.value" :loading="list.loading.value" :done="list.done.value" @more="list.loadMore()" />
  </section>
</template>

<style scoped>
form { display: flex; gap: 0.5rem; }
input[type="search"] { flex: 1; min-height: 2.5rem; font: inherit; padding: 0 0.75rem; }
</style>
