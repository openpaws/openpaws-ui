<script setup lang="ts">
import type { Rating } from '~/types/api'

const props = defineProps<{ rating: Rating }>()
const meta = {
  general: { short: 'G', name: 'General' },
  mature: { short: 'M', name: 'Mature' },
  adult: { short: 'A', name: 'Adult' },
} as const
const info = computed(() => meta[props.rating])
</script>

<template>
  <span
    class="rating-badge"
    :class="`rating-${rating}`"
    data-testid="rating-badge"
    role="img"
    :aria-label="info.name"
  >{{ info.short }}</span>
</template>

<style scoped>
.rating-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.375rem;
  border: 1px solid currentColor;
  border-radius: 0.375rem;
  background: var(--surface);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
}
.rating-mature { color: var(--text); }
.rating-adult { color: var(--danger); }
</style>
