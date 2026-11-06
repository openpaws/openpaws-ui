<script setup lang="ts">
import type { UploadKind } from '~/types/api'
import { UPLOAD_MIMES, type UploadView } from '~/composables/useUploader'

const props = defineProps<{ name: string, label: string, kind: UploadKind, view: UploadView, hint?: string }>()
const emit = defineEmits<{ pick: [file: File | null], resume: [] }>()
const uid = useId()
const accept = computed(() => UPLOAD_MIMES[props.kind].join(','))

function onChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  emit('pick', f)
}
</script>

<template>
  <div class="slot">
    <label :for="`u-${uid}`">{{ label }}</label>
    <p v-if="hint" class="hint">
      {{ hint }}
    </p>
    <input :id="`u-${uid}`" type="file" :name="name" :accept="accept" @change="onChange">
    <template v-if="view.state !== 'idle'">
      <div v-if="view.state === 'uploading' || view.state === 'completing'" class="row">
        <progress :value="view.progress" max="1" :aria-label="`${label} upload progress`" />
        <span role="status">{{ view.state === 'completing' ? 'Finishing…' : `${Math.round(view.progress * 100)}%` }}</span>
      </div>
      <p v-else-if="view.state === 'done'" role="status" class="ok">
        Uploaded {{ view.name }}
      </p>
      <div v-else-if="view.state === 'error'" class="row" role="alert">
        <span class="field__error">{{ view.error }}</span>
        <button v-if="view.name" type="button" data-test="resume" @click="emit('resume')">
          Try again
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.slot { display: grid; gap: 0.35rem; }
label { font-weight: 600; }
.row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
progress { flex: 1; min-width: 8rem; }
.hint { margin: 0; opacity: 0.8; }
.ok { margin: 0; }
.field__error { color: var(--danger); }
</style>
