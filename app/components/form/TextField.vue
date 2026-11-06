<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  name: string
  type?: string
  autocomplete?: string
  error?: string
  required?: boolean
}>(), { type: 'text', autocomplete: undefined, error: undefined })
const model = defineModel<string>({ default: '' })
const uid = useId()
const inputId = `f-${uid}`
const errorId = `e-${uid}`
</script>

<template>
  <div class="field">
    <label :for="inputId">{{ props.label }}</label>
    <input
      :id="inputId"
      v-model="model"
      :name="props.name"
      :type="props.type"
      :autocomplete="props.autocomplete"
      :required="props.required"
      :aria-invalid="props.error ? 'true' : undefined"
      :aria-describedby="props.error ? errorId : undefined"
    >
    <p v-if="props.error" :id="errorId" class="field__error">
      {{ props.error }}
    </p>
  </div>
</template>

<style scoped>
.field { display: grid; gap: 0.25rem; }
label { font-weight: 600; }
input {
  font: inherit;
  padding: 0.5rem 0.65rem;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 0.4rem;
}
input[aria-invalid='true'] { border-color: var(--danger); }
.field__error { margin: 0; color: var(--danger); font-size: 0.9rem; }
</style>
