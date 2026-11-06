<script setup lang="ts">
import type { Submission } from '~/types/api'

useHead({ title: 'OpenPaws' })
const route = useRoute()
const router = useRouter()

const filters = computed(() => {
  const out: Record<string, string> = {}
  for (const k of ['type', 'sort', 'period'] as const) {
    const v = route.query[k]
    if (typeof v === 'string' && v) out[k] = v
  }
  if (out.sort !== 'popular') delete out.period
  return out
})
const query = computed(() => ({ ...filters.value }))
const list = useCursorList<Submission>('/browse', query, { key: 'browse' })
if (!list.items.value.length && !list.done.value) await list.loadMore()

function update(next: Record<string, string>) {
  return router.push({ path: '/', query: next })
}
</script>

<template>
  <section>
    <h1>OpenPaws</h1>
    <SubmissionBrowseFilters
      :model-value="filters"
      default-sort="new"
      show-period
      :sorts="[{ value: 'new', label: 'Newest' }, { value: 'popular', label: 'Popular' }]"
      @update:model-value="update"
    />
    <p v-if="list.error.value" class="error" role="alert">Could not load submissions.</p>
    <SubmissionGrid :items="list.items.value" :loading="list.loading.value" :done="list.done.value" @more="list.loadMore()" />
  </section>
</template>
