<script setup lang="ts">
import type { Submission } from '~/types/api'

const props = defineProps<{ submission: Submission }>()
const auth = useAuthStore()
const isOwner = computed(() => !!auth.me && auth.me.username === props.submission.user.username)
const artist = computed(() => props.submission.user.display_name || props.submission.user.username)
const date = computed(() => {
  const d = props.submission.published_at ?? props.submission.created_at
  return d ? new Date(d) : null
})
const dateLabel = computed(() => date.value?.toLocaleDateString('en', { dateStyle: 'medium', timeZone: 'UTC' }))
</script>

<template>
  <header class="sub-meta">
    <h1>{{ submission.title }}</h1>
    <p class="by">
      by <NuxtLink :to="`/user/${submission.user.username}`">{{ artist }}</NuxtLink>
      <RatingBadge :rating="submission.rating" />
    </p>
    <p class="muted stats">
      <time v-if="date" :datetime="date.toISOString()">{{ dateLabel }}</time>
      <span>{{ submission.views_count }} {{ submission.views_count === 1 ? 'view' : 'views' }}</span>
      <NuxtLink v-if="isOwner" :to="`/view/${submission.id}/edit`">Edit</NuxtLink>
    </p>
    <ul v-if="submission.tags.length" class="tags" aria-label="Tags">
      <li v-for="t in submission.tags" :key="t"><NuxtLink :to="`/tag/${t}`">#{{ t }}</NuxtLink></li>
    </ul>
    <!-- eslint-disable-next-line vue/no-v-html -- description_html is sanitised by the API -->
    <div v-if="submission.description_html" class="description" data-testid="description" v-html="submission.description_html" />
  </header>
</template>

<style scoped>
.by { display: flex; align-items: center; gap: 0.5rem; }
.stats { display: flex; gap: 1rem; flex-wrap: wrap; }
.tags { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0; list-style: none; }
.description { overflow-wrap: anywhere; }
</style>
