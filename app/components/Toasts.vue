<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
const { items } = useToasts()
</script>

<template>
  <div class="toasts" aria-live="polite">
    <p v-for="t in items" :key="t.id" class="toast" :class="`toast--${t.kind}`" :role="t.kind === 'error' ? 'alert' : 'status'">
      {{ t.msg }}
    </p>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  inset: auto 1rem 1rem auto;
  display: grid;
  gap: 0.5rem;
  max-width: min(24rem, calc(100vw - 2rem));
  z-index: 50;
}
.toast {
  margin: 0;
  padding: 0.6rem 0.9rem;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
}
.toast--error {
  border-color: var(--danger);
}
</style>
