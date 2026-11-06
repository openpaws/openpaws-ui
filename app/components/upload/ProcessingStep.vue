<script setup lang="ts">
import type { Single, Submission } from '~/types/api'

const props = withDefaults(defineProps<{ id: string, interval?: number }>(), { interval: 3000 })
const emit = defineEmits<{ retry: [id: string] }>()
const api = useApi()
const status = ref<'processing' | 'failed' | 'ready'>('processing')

usePoll(() => status.value === 'processing', async () => {
  const s = (await api<Single<Submission>>(`/submissions/${encodeURIComponent(props.id)}`)).data
  if (s.status === 'failed') status.value = 'failed'
  else if (s.status !== 'processing') {
    status.value = 'ready'
    await navigateTo(`/view/${s.id}`)
  }
}, props.interval)
</script>

<template>
  <section class="processing" data-test="processing">
    <template v-if="status === 'processing'">
      <h2>Processing…</h2>
      <p role="status">
        Your submission is being prepared. You will be taken to it when it is ready — you can also leave this page; it keeps processing.
      </p>
    </template>
    <p v-else-if="status === 'ready'" role="status">
      Done — opening your submission…
    </p>
    <div v-else role="alert">
      <h2>Processing failed</h2>
      <p>This file could not be processed. Try again with the same or a different file.</p>
      <NuxtLink :to="`/upload?retry=${id}`" @click="emit('retry', id)">
        Retry upload
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.processing { display: grid; gap: 0.5rem; }
h2 { margin: 0; }
</style>
