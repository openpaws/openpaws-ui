<script setup lang="ts">
const auth = useAuthStore()
async function onLogout() {
  await auth.logout()
  await navigateTo('/')
}
</script>

<template>
  <header class="app-header">
    <div class="container app-header__inner">
      <NuxtLink to="/" class="app-header__logo">OpenPaws</NuxtLink>
      <nav class="app-header__nav" aria-label="Account">
        <template v-if="auth.me">
          <NuxtLink to="/upload">Upload</NuxtLink>
          <span class="muted">{{ auth.me.display_name }}</span>
          <button type="button" @click="onLogout">Log out</button>
        </template>
        <template v-else>
          <NuxtLink to="/login">Log in</NuxtLink>
          <NuxtLink to="/register">Sign up</NuxtLink>
        </template>
        <ThemeToggle />
      </nav>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.app-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.5rem;
}
.app-header__nav {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.app-header__logo {
  font-weight: 700;
  font-size: 1.25rem;
  color: var(--text);
  text-decoration: none;
}
</style>
