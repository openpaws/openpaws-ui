<script setup lang="ts">
import type { Folder } from '~/types/api'

const props = defineProps<{ username: string, folders: Folder[] }>()
const to = (f: Folder) => {
  const base = `/user/${props.username}`
  return f.kind === 'gallery' ? `${base}/gallery` : f.kind === 'scraps' ? `${base}/scraps` : `${base}/folder/${f.id}`
}
</script>

<template>
  <nav aria-label="Folders" class="folder-nav">
    <NuxtLink v-for="f in folders" :key="f.id" :to="to(f)" class="pill">
      {{ f.name }} <span class="count">{{ f.count }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.folder-nav { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1rem 0; }
.pill { padding: 0.35rem 0.8rem; border: 1px solid var(--border); border-radius: 999px; color: var(--text); text-decoration: none; }
.pill.router-link-exact-active { background: var(--surface); font-weight: 600; }
.count { color: var(--muted); font-size: 0.85em; }
</style>
