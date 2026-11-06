<template>
  <div class="shell">
    <AppHeader />
    <main id="main" class="container shell__main">
      <slot />
    </main>
    <footer class="shell__footer">
      <div class="container">
        <small class="muted">OpenPaws &mdash; a public furry art gallery.</small>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
.shell__main {
  flex: 1;
  width: 100%;
  padding-block: 1.5rem;
}
.shell__footer {
  border-top: 1px solid var(--border);
  padding-block: 1rem;
}
</style>
