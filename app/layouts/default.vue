<template>
  <div class="shell">
    <a href="#main" class="skip-link">Skip to content</a>
    <AppHeader />
    <main id="main" tabindex="-1" class="container shell__main">
      <slot />
    </main>
    <footer class="shell__footer">
      <div class="container">
        <small class="muted">OpenPaws &mdash; a public furry art gallery.</small>
      </div>
    </footer>
    <Toasts />
  </div>
</template>

<style scoped>
.skip-link {
  position: absolute;
  left: 0.5rem;
  top: -4rem;
  z-index: 100;
  padding: 0.5rem 1rem;
  border-radius: 0.4rem;
  background: var(--accent);
  color: var(--bg);
}
.skip-link:focus {
  top: 0.5rem;
}
.shell__main:focus {
  outline: none;
}
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
