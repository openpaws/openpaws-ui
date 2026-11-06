<script setup lang="ts">
// Type / sort / period selectors; `modelValue` is the URL query. Period is only for popular sort.
const props = defineProps<{ modelValue: Record<string, string>, sorts: { value: string, label: string }[], defaultSort: string }>()
const emit = defineEmits<{ 'update:modelValue': [Record<string, string>] }>()

const sort = computed(() => props.modelValue.sort || props.defaultSort)

function set(key: string, value: string) {
  const next: Record<string, string> = { ...props.modelValue, [key]: value }
  if (key === 'sort' && value !== 'popular') delete next.period
  for (const k of Object.keys(next)) if (!next[k]) Reflect.deleteProperty(next, k)
  emit('update:modelValue', next)
}
const on = (key: string) => (e: Event) => set(key, (e.target as HTMLSelectElement).value)
</script>

<template>
  <div class="filters">
    <label>Type
      <select name="type" :value="modelValue.type || ''" @change="on('type')($event)">
        <option value="">All</option>
        <option value="image">Images</option>
        <option value="writing">Writing</option>
        <option value="audio">Audio</option>
        <option value="video">Video</option>
      </select>
    </label>
    <label>Sort
      <select name="sort" :value="sort" @change="on('sort')($event)">
        <option v-for="s in sorts" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
    </label>
    <label v-if="sort === 'popular'">Period
      <select name="period" :value="modelValue.period || 'week'" @change="on('period')($event)">
        <option value="day">Today</option>
        <option value="week">This week</option>
        <option value="month">This month</option>
        <option value="all">All time</option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.filters { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-block: 1rem; }
label { display: flex; align-items: center; gap: 0.4rem; color: var(--muted); }
select { min-height: 2.25rem; font: inherit; }
</style>
