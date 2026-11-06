<script setup lang="ts">
import type { Tag } from '~/types/api'
import { tagSlug } from '~/utils/tagSlug'

const props = withDefaults(defineProps<{ debounce?: number, max?: number, error?: string }>(), { debounce: 200, max: 60, error: undefined })
const tags = defineModel<string[]>({ required: true })

const api = useApi()
const uid = useId()
const text = ref('')
const suggestions = ref<Tag[]>([])
const full = computed(() => tags.value.length >= props.max)
let timer: ReturnType<typeof setTimeout> | null = null
let seq = 0

function add(raw: string) {
  const slug = tagSlug(raw)
  text.value = ''
  suggestions.value = []
  if (!slug || full.value || tags.value.includes(slug)) return
  tags.value = [...tags.value, slug]
}

function remove(i: number) {
  tags.value = tags.value.filter((_, j) => j !== i)
}

async function lookup(q: string, mine: number) {
  try {
    const res = await api<{ data: Tag[] }>('/tags/autocomplete', { query: { q } })
    if (mine === seq) suggestions.value = res.data.filter(t => !tags.value.includes(t.slug))
  }
  catch {
    if (mine === seq) suggestions.value = []
  }
}

watch(text, (q) => {
  if (timer) clearTimeout(timer)
  const mine = ++seq
  if (!tagSlug(q)) {
    suggestions.value = []
    return
  }
  timer = setTimeout(() => lookup(q, mine), props.debounce)
})
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    add(text.value)
  }
  else if (e.key === 'Backspace' && !text.value && tags.value.length) {
    remove(tags.value.length - 1)
  }
}
</script>

<template>
  <div class="tag-input">
    <label :for="`tag-${uid}`">Tags</label>
    <ul v-if="tags.length" class="chips" aria-label="Selected tags">
      <li v-for="(t, i) in tags" :key="t" class="chip" data-test="chip">
        {{ t }}
        <button type="button" :aria-label="`Remove tag ${t}`" @click="remove(i)">
          ×
        </button>
      </li>
    </ul>
    <input
      :id="`tag-${uid}`"
      v-model="text"
      name="tag"
      type="text"
      autocomplete="off"
      :disabled="full"
      :placeholder="full ? '' : 'Type a tag, press Enter'"
      :aria-describedby="`tag-hint-${uid}`"
      @keydown="onKeydown"
      @blur="suggestions = []"
    >
    <ul v-if="suggestions.length" class="suggestions" role="listbox">
      <li v-for="s in suggestions" :key="s.slug" role="option" data-test="suggestion" @mousedown.prevent="add(s.slug)">
        {{ s.slug }} <span class="muted">({{ s.usage_count }})</span>
      </li>
    </ul>
    <p :id="`tag-hint-${uid}`" class="hint">
      {{ full ? `${max} tags maximum.` : `${tags.length} / ${max} tags` }}
    </p>
    <p v-if="error" class="field__error">
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.tag-input { display: grid; gap: 0.25rem; position: relative; }
label { font-weight: 600; }
input { font: inherit; padding: 0.5rem 0.65rem; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 0.4rem; }
.chips { display: flex; flex-wrap: wrap; gap: 0.35rem; list-style: none; margin: 0; padding: 0; }
.chip { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.1rem 0.5rem; border: 1px solid var(--border); border-radius: 1rem; }
.chip button { border: 0; background: none; color: inherit; cursor: pointer; padding: 0 0.2rem; }
.suggestions { list-style: none; margin: 0; padding: 0.25rem 0; border: 1px solid var(--border); border-radius: 0.4rem; background: var(--surface); }
.suggestions li { padding: 0.3rem 0.65rem; cursor: pointer; }
.suggestions li:hover { background: var(--border); }
.hint { margin: 0; opacity: 0.8; font-size: 0.9rem; }
.muted { opacity: 0.7; }
.field__error { margin: 0; color: var(--danger); font-size: 0.9rem; }
</style>
