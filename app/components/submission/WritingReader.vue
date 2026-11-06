<script setup lang="ts">
import type { Submission } from '~/types/api'

const props = defineProps<{ submission: Submission }>()
const KEY = 'openpaws:writing-size'
const sizes = [1, 1.2, 1.45] // rem, 3 steps
const step = ref(0)

function read(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY))
    return Number.isInteger(v) && v >= 0 && v < sizes.length && localStorage.getItem(KEY) !== null ? v : null
  }
  catch {
    return null
  }
}
function set(n: number) {
  step.value = Math.min(sizes.length - 1, Math.max(0, n))
  try {
    localStorage.setItem(KEY, String(step.value))
  }
  catch {
    // storage unavailable: the choice just won't persist
  }
}
onMounted(() => {
  const v = read()
  if (v !== null) step.value = v
})

const doc = computed(() => props.submission.media.document)
const html = computed(() => props.submission.body_html ?? '')
</script>

<template>
  <div class="writing-reader">
    <div class="reader-controls" role="group" aria-label="Text size">
      <button type="button" aria-label="Smaller text" :disabled="step === 0" @click="set(step - 1)">A−</button>
      <button type="button" aria-label="Larger text" :disabled="step === sizes.length - 1" @click="set(step + 1)">A+</button>
      <a v-if="doc?.url" :href="doc.url" download rel="noopener">Download document</a>
    </div>
    <!-- eslint-disable-next-line vue/no-v-html -- body_html is sanitised by the API -->
    <div v-if="html" class="reader-body" data-testid="reader-body" :style="{ fontSize: `${sizes[step]}rem` }" v-html="html" />
    <p v-else class="media-missing" data-testid="media-missing">Media is not available yet.</p>
  </div>
</template>

<style scoped>
.reader-controls { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
.reader-body { max-width: 42rem; margin: 0 auto; line-height: 1.7; overflow-wrap: anywhere; }
.media-missing { color: var(--muted); }
</style>
