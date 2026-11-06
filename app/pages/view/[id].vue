<script setup lang="ts">
import type { Single, Submission } from '~/types/api'
import { ApiError } from '~/utils/apiError'

const route = useRoute()
const id = computed(() => String(route.params.id))
const api = useApi()
const auth = useAuthStore()

const { data: submission, error, refresh } = await useAsyncData<Submission | null>(
  `submission-${id.value}`,
  async () => (await api<Single<Submission>>(`/submissions/${encodeURIComponent(id.value)}`)).data,
  { watch: [id] },
)

if (error.value instanceof ApiError && error.value.status === 404) {
  throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
}
if (error.value) {
  throw createError({ statusCode: error.value instanceof ApiError ? error.value.status || 500 : 500, statusMessage: 'Something went wrong', fatal: true })
}
if (submission.value) useSubmissionMeta(submission)

const isOwner = computed(() => !!auth.me && !!submission.value && auth.me.username === submission.value.user.username)

usePoll(() => isOwner.value && submission.value?.status === 'processing', () => refresh())

const viewers = { image: resolveComponent('SubmissionImageViewer'), writing: resolveComponent('SubmissionWritingReader'), audio: resolveComponent('SubmissionAudioPlayer'), video: resolveComponent('SubmissionVideoPlayer') }
</script>

<template>
  <article v-if="submission" class="view-page">
    <SubmissionMeta :submission="submission" />
    <section class="viewer" aria-label="Submission">
      <p v-if="submission.status === 'processing'" role="status" data-testid="status-processing">Processing…</p>
      <div v-else-if="submission.status === 'failed'" role="alert" data-testid="status-failed">
        <p>Processing failed. This submission could not be prepared.</p>
        <NuxtLink v-if="isOwner" :to="`/upload?retry=${submission.id}`">Retry in the upload wizard</NuxtLink>
      </div>
      <component :is="viewers[submission.type]" v-else :submission="submission" />
    </section>
  </article>
</template>

<style scoped>
.view-page { display: flex; flex-direction: column; gap: 1.5rem; }
</style>
