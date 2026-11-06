<script setup lang="ts">
import type { Submission } from '~/types/api'

const props = defineProps<{ items: Submission[], loading: boolean, done: boolean }>()
const emit = defineEmits<{ more: [] }>()

const sentinel = ref<HTMLElement | null>(null)
const mounted = ref(false)
const hasObserver = ref(true)
let observer: IntersectionObserver | null = null

function attach() {
  observer?.disconnect()
  observer = null
  if (!hasObserver.value || !sentinel.value) return
  observer = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting) && !props.loading && !props.done) emit('more')
  }, { rootMargin: '400px' })
  observer.observe(sentinel.value)
}

onMounted(() => {
  mounted.value = true
  hasObserver.value = typeof IntersectionObserver !== 'undefined'
  nextTick(attach)
})
watch(() => [props.items.length, props.loading, props.done], () => nextTick(attach))
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="grid-wrap">
    <ul v-if="items.length" class="grid">
      <li v-for="s in items" :key="s.id">
        <SubmissionCard :submission="s" />
      </li>
    </ul>
    <p v-else-if="!loading" class="empty">Nothing here yet.</p>
    <p v-if="loading" class="status" role="status">Loading…</p>
    <template v-if="!done">
      <div v-if="hasObserver" ref="sentinel" class="sentinel" data-testid="sentinel" aria-hidden="true" />
      <button v-else-if="mounted && !loading" type="button" class="more" @click="emit('more')">
        Load more
      </button>
    </template>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.grid > li { min-width: 0; }
.empty, .status { padding: 2rem 0; text-align: center; color: var(--muted); }
.sentinel { height: 1px; }
.more {
  display: block;
  min-height: 2.5rem;
  margin: 1rem auto;
  padding: 0 1rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  cursor: pointer;
}
</style>
