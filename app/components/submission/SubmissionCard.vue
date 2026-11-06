<script setup lang="ts">
import type { Submission } from '~/types/api'

const props = defineProps<{ submission: Submission }>()

const typeLabels = { image: 'Image', writing: 'Writing', audio: 'Audio', video: 'Video' } as const
const typeIcons = { image: '🖼', writing: '📝', audio: '🎵', video: '🎬' } as const

const thumb = computed(() => props.submission.media.thumb_md)
const srcset = computed(() => {
  const m = props.submission.media
  return ([['thumb_sm', 200], ['thumb_md', 400], ['thumb_lg', 800]] as const)
    .filter(([k]) => m[k]?.url)
    .map(([k, w]) => `${m[k]!.url} ${w}w`)
    .join(', ')
})
const artist = computed(() => props.submission.user.display_name || props.submission.user.username)
const showBadge = computed(() => props.submission.rating !== 'general')
</script>

<template>
  <NuxtLink :to="`/view/${submission.id}`" class="card">
    <div class="card-media">
      <img
        v-if="thumb?.url"
        :src="thumb.url"
        :srcset="srcset"
        sizes="(min-width: 1024px) 220px, (min-width: 480px) 33vw, 50vw"
        :alt="submission.alt_text || submission.title"
        :width="thumb.width"
        :height="thumb.height"
        loading="lazy"
        decoding="async"
      >
      <div v-else class="placeholder" data-testid="placeholder">
        <span class="placeholder-icon" aria-hidden="true">{{ typeIcons[submission.type] }}</span>
        <span class="placeholder-label">{{ typeLabels[submission.type] }}</span>
      </div>
      <RatingBadge v-if="showBadge" class="card-badge" :rating="submission.rating" />
    </div>
    <div class="card-body">
      <span class="card-title">{{ submission.title }}</span>
      <span class="card-artist">{{ artist }}</span>
    </div>
  </NuxtLink>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface);
  color: var(--text);
  text-decoration: none;
}
.card-media {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--bg);
}
.card-media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  width: 100%;
  height: 100%;
  color: var(--muted);
}
.placeholder-icon { font-size: 2rem; }
.card-badge { position: absolute; top: 0.375rem; right: 0.375rem; }
.card-body {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  padding: 0.5rem 0.625rem;
}
.card-title {
  overflow: hidden;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-weight: 600;
}
.card-artist {
  overflow: hidden;
  overflow-wrap: anywhere;
  color: var(--muted);
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
