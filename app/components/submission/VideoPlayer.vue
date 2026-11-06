<script setup lang="ts">
import type { Submission } from '~/types/api'

const props = defineProps<{ submission: Submission }>()
const src = computed(() => props.submission.media.transcode)
const poster = computed(() => props.submission.media.cover?.url)
</script>

<template>
  <div class="video-player">
    <video v-if="src?.url" controls preload="metadata" :src="src.url" :poster="poster" />
    <p v-else class="media-missing" data-testid="media-missing">Media is not available yet.</p>
  </div>
</template>

<style scoped>
video { display: block; width: 100%; max-height: 80vh; background: #000; }
.media-missing { color: var(--muted); }
</style>
