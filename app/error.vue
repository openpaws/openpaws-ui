<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error?.statusCode === 404)
const requestId = computed(() => {
  const id = (props.error?.data as { requestId?: unknown } | undefined)?.requestId
  return typeof id === 'string' && id ? id : ''
})
useHead(() => ({ title: `${notFound.value ? 'Not found' : 'Something went wrong'} — OpenPaws` }))
</script>

<template>
  <NuxtLayout>
    <section class="error-page">
      <h1>{{ notFound ? 'Not found' : 'Something went wrong' }}</h1>
      <p v-if="notFound" class="muted">That page doesn't exist, or you can't see it.</p>
      <p v-else class="muted">Please try again in a moment.</p>
      <p v-if="requestId" class="muted error-page__ref">Reference: {{ requestId }}</p>
      <NuxtLink to="/" @click="clearError()">Go home</NuxtLink>
    </section>
  </NuxtLayout>
</template>

<style scoped>
.error-page__ref {
  font-size: 0.875rem;
  user-select: all;
}
</style>
