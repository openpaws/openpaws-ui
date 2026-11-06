<script setup lang="ts">
import type { Submission, Tag } from '~/types/api'
import { ApiError } from '~/utils/apiError'

const route = useRoute()
const slug = String(route.params.slug)
useHead({ title: `#${slug} — OpenPaws` })

const key = `tag:${slug}`
const list = useCursorList<Submission>(`/tags/${encodeURIComponent(slug)}`, computed(() => ({})), { key })
if (!list.items.value.length && !list.done.value) await list.loadMore()

const notFound = computed(() => list.error.value instanceof ApiError && list.error.value.status === 404)
if (notFound.value) showError(createError({ statusCode: 404, statusMessage: 'Not found' }))
const tag = computed(() => list.extra.value.tag as Tag | undefined)
</script>

<template>
  <section v-if="notFound">
    <h1>Not found</h1>
    <p class="muted">That tag doesn't exist or has nothing you can see.</p>
  </section>
  <section v-else>
    <h1>#{{ slug }}</h1>
    <p v-if="tag" class="muted">{{ tag.usage_count }} {{ tag.usage_count === 1 ? 'submission' : 'submissions' }}</p>
    <p v-if="list.error.value" class="error" role="alert">Could not load this tag.</p>
    <SubmissionGrid :items="list.items.value" :loading="list.loading.value" :done="list.done.value" @more="list.loadMore()" />
  </section>
</template>
