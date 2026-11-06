<script setup lang="ts">
import type { Submission } from '~/types/api'

const props = defineProps<{ submission: Submission }>()
const full = ref(false)
const img = computed(() => props.submission.media.preview)
const original = computed(() => props.submission.media.original)
</script>

<template>
  <div class="image-viewer">
    <template v-if="img?.url">
      <button
        type="button"
        class="image-toggle"
        :aria-pressed="full"
        :aria-label="full ? 'Fit image to screen' : 'View full size'"
        @click="full = !full"
      >
        <img
          :src="img.url"
          :alt="submission.title"
          :width="img.width"
          :height="img.height"
          :class="full ? 'is-full' : 'is-fit'"
        >
      </button>
    </template>
    <p v-else class="media-missing" data-testid="media-missing">Media is not available yet.</p>
    <a v-if="original?.url" :href="original.url" download rel="noopener">Download original</a>
  </div>
</template>

<style scoped>
.image-viewer { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; overflow: auto; }
.image-toggle { padding: 0; border: 0; background: none; cursor: zoom-in; max-width: 100%; }
.image-toggle[aria-pressed='true'] { cursor: zoom-out; }
img.is-fit { display: block; max-width: 100%; max-height: 85vh; width: auto; height: auto; object-fit: contain; }
img.is-full { display: block; max-width: none; }
.media-missing { color: var(--muted); }
</style>
