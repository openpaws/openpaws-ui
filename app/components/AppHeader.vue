<template>
  <header class="app-header">
    <div class="container app-header__inner">
      <NuxtLink to="/" class="app-header__logo">OpenPaws</NuxtLink>
      <ThemeToggle />
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
.app-header__logo {
  font-weight: 700;
  font-size: 1.25rem;
  color: var(--text);
  text-decoration: none;
}
</style>
