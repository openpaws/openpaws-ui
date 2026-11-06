<script setup lang="ts">
import type { Paginated, Submission } from '~/types/api'

const api = useApi()
const { username, user, profile, folders, notFound, useMeta, ready } = useUserProfile()
useMeta()

const latest = useAsyncData(
  () => `latest:${username.value}`,
  async () => (await api<Paginated<Submission>>(`/users/${encodeURIComponent(username.value)}/submissions`, { query: { folder: 'gallery' } })).data.slice(0, 12),
)
await Promise.all([ready, latest])
const latestItems = computed(() => (user.value ? latest.data.value ?? [] : []))
</script>

<template>
  <section v-if="notFound">
    <h1>Not found</h1>
    <p class="muted">That user doesn't exist.</p>
  </section>
  <section v-else-if="user">
    <UserProfileHeader :user="user" :profile="profile" full />
    <UserFolderNav :username="username" :folders="folders" />
    <template v-if="profile?.pinned.length">
      <h2>Pinned</h2>
      <SubmissionGrid :items="profile.pinned" :loading="false" :done="true" />
    </template>
    <h2>Latest</h2>
    <SubmissionGrid :items="latestItems" :loading="latest.status.value === 'pending'" :done="true" />
    <p><NuxtLink :to="`/user/${username}/gallery`">View gallery</NuxtLink></p>
  </section>
  <p v-else class="muted" role="status">Loading…</p>
</template>
