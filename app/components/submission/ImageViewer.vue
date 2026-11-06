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
        @click="full = !full"
      >
        <!-- The button's name is the image's alt text plus the action, so the alt is announced. -->
        <img
          :src="img.url"
          :alt="submission.alt_text || submission.title"
          :width="img.width"
          :height="img.height"
          :class="full ? 'is-full' : 'is-fit'"
        >
        <span class="visually-hidden">(full size)</span>
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
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.media-missing { color: var(--muted); }
</style>
