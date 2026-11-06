<script setup lang="ts">
const { theme, cycle } = useTheme()
const labels = { system: 'System', light: 'Light', dark: 'Dark' } as const
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :data-theme-mode="theme"
    :aria-label="`Theme: ${labels[theme]}. Activate to change.`"
    @click="cycle"
  >
    <span aria-hidden="true">{{ labels[theme] }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  min-height: 2.5rem;
  min-width: 5rem;
  padding: 0 0.875rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  cursor: pointer;
}
</style>
