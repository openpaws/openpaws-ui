<script setup lang="ts">
import type { Profile, User } from '~/types/api'

const props = defineProps<{ user: User, profile: Profile | null, full?: boolean }>()
const name = computed(() => props.user.display_name || props.user.username)
const links = computed(() => (props.profile?.links ?? []) as { label: string, url: string }[])
const meta = computed(() => [props.profile?.species, props.profile?.pronouns].filter(Boolean).join(' · '))
</script>

<template>
  <header class="profile-header">
    <img v-if="user.banner_url" class="banner" :src="user.banner_url" alt="">
    <div v-else class="banner banner--blank" aria-hidden="true" />
    <div class="who">
      <img v-if="user.avatar_url" class="avatar" :src="user.avatar_url" :alt="`${name}'s avatar`" width="96" height="96">
      <span v-else class="avatar avatar--blank" role="img" :aria-label="`${name}'s avatar`">{{ name.charAt(0).toUpperCase() }}</span>
      <div>
        <h1>
          <NuxtLink :to="`/user/${user.username}`">
            {{ name }}
          </NuxtLink>
        </h1>
        <p class="muted">
          @{{ user.username }}<template v-if="meta">
            · {{ meta }}
          </template>
        </p>
      </div>
    </div>
    <template v-if="full && profile">
      <!-- bio_html is sanitised by the API -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-if="profile.bio_html" class="bio" v-html="profile.bio_html" />
      <ul v-if="links.length" class="links">
        <li v-for="l in links" :key="l.url">
          <a :href="l.url" rel="nofollow ugc noopener" target="_blank">{{ l.label }}</a>
        </li>
      </ul>
    </template>
  </header>
</template>

<style scoped>
.banner { display: block; width: 100%; height: 140px; object-fit: cover; border-radius: 0.5rem; background: var(--surface); }
.banner--blank { border: 1px solid var(--border); }
.who { display: flex; gap: 1rem; align-items: flex-end; margin-top: -2.5rem; padding: 0 1rem; }
.avatar { width: 96px; height: 96px; border-radius: 50%; border: 3px solid var(--bg, #fff); object-fit: cover; background: var(--surface); }
.avatar--blank { display: grid; place-items: center; font-size: 2.5rem; font-weight: 700; color: var(--muted); }
h1 { margin: 0; }
h1 a { color: inherit; text-decoration: none; }
.muted { margin: 0; color: var(--muted); }
.links { display: flex; flex-wrap: wrap; gap: 0.75rem; padding: 0; list-style: none; }
</style>
