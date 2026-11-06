<script setup lang="ts">
defineProps<{ message?: string }>()
</script>

<template>
  <p v-if="message" class="form-errors" role="alert">
    {{ message }}
  </p>
</template>

<style scoped>
.form-errors {
  margin: 0;
  padding: 0.5rem 0.75rem;
  color: var(--danger);
  border: 1px solid var(--danger);
  border-radius: 0.4rem;
}
</style>
