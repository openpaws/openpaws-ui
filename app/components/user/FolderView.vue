<script setup lang="ts">
import type { Submission } from '~/types/api'
import { ApiError } from '~/utils/apiError'

/** A user's folder listing: `folder` is 'gallery', 'scraps' or a custom folder's public id. */
const props = defineProps<{ folder: string }>()
const { username, user, profile, folders, refreshFolders, notFound, isOwner, useMeta, ready } = useUserProfile()
useMeta()
await ready

const key = computed(() => `${username.value}:${props.folder}`)
const list = useCursorList<Submission>(
  () => `/users/${encodeURIComponent(username.value)}/submissions`,
  computed(() => ({ folder: props.folder })),
  { key: 'folderlist' },
)
const { items } = list
// Keyed state is shared across users and folders: reload whenever either changes.
if (import.meta.client && !useNuxtApp().isHydrating) list.reset()
if (!items.value.length && !list.done.value) await list.loadMore()
watch(key, () => {
  list.reset()
  void list.loadMore()
})

const listNotFound = computed(() => list.error.value instanceof ApiError && list.error.value.status === 404)
watch(listNotFound, (v) => {
  if (v) showError(createError({ statusCode: 404, statusMessage: 'Not found', data: { requestId: (list.error.value as ApiError).requestId } }))
}, { immediate: true })

const current = computed(() => folders.value.find(f => f.kind === props.folder || f.id === props.folder))
const heading = computed(() => current.value?.name ?? (props.folder === 'scraps' ? 'Scraps' : props.folder === 'gallery' ? 'Gallery' : 'Folder'))

async function loadAll() {
  while (!list.done.value && !list.error.value) {
    await list.loadMore()
  }
}
async function onChanged(info: { deleted?: string }) {
  await refreshFolders()
  if (info.deleted && info.deleted === current.value?.id) await navigateTo(`/user/${username.value}/gallery`)
}
</script>

<template>
  <section v-if="notFound || listNotFound">
    <h1>Not found</h1>
    <p class="muted">That page doesn't exist or has nothing you can see.</p>
  </section>
  <section v-else>
    <UserProfileHeader v-if="user" :user="user" :profile="profile" />
    <UserFolderNav :username="username" :folders="folders" />
    <h2>{{ heading }}</h2>
    <p v-if="list.error.value" class="error" role="alert">
      Could not load this folder.
    </p>
    <SubmissionGrid :items="items" :loading="list.loading.value" :done="list.done.value" @more="list.loadMore()" />
    <UserFolderManager
      v-if="isOwner && current"
      v-model:items="items"
      :username="username"
      :folders="folders"
      :current="current.id"
      :loading="list.loading.value"
      :done="list.done.value"
      @load-all="loadAll"
      @changed="onChanged"
    />
  </section>
</template>
