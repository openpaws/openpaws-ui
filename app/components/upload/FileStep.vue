<script setup lang="ts">
import type { SubmissionType } from '~/types/api'
import { allowsCover, MAIN_KIND, type UploadView } from '~/composables/useUploader'

defineProps<{ locked?: boolean, main: UploadView, cover: UploadView }>()
const emit = defineEmits<{ pick: [slot: 'main' | 'cover', file: File | null], resume: [slot: 'main' | 'cover'] }>()
const type = defineModel<SubmissionType | null>('type', { required: true })

const types: { value: SubmissionType, label: string }[] = [
  { value: 'image', label: 'Image' },
  { value: 'writing', label: 'Writing' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
]
const mainLabel: Record<SubmissionType, string> = {
  image: 'Image file',
  writing: 'Document (optional)',
  audio: 'Audio file',
  video: 'Video file',
}
</script>

<template>
  <div class="file-step">
    <fieldset v-if="!locked">
      <legend>What are you uploading?</legend>
      <label v-for="t in types" :key="t.value" class="check">
        <input v-model="type" type="radio" name="type" :value="t.value"> {{ t.label }}
      </label>
    </fieldset>
    <template v-if="type">
      <UploadSlot
        :key="`main-${type}`"
        name="file"
        :label="mainLabel[type]"
        :kind="MAIN_KIND[type]"
        :view="main"
        :hint="type === 'writing' ? 'You can write or paste your text in the next step; attach a TXT, DOCX, ODT or PDF if you like.' : undefined"
        @pick="f => emit('pick', 'main', f)"
        @resume="emit('resume', 'main')"
      />
      <UploadSlot
        v-if="allowsCover(type)"
        :key="`cover-${type}`"
        name="cover"
        label="Cover image (optional)"
        kind="cover"
        :view="cover"
        @pick="f => emit('pick', 'cover', f)"
        @resume="emit('resume', 'cover')"
      />
    </template>
  </div>
</template>

<style scoped>
.file-step { display: grid; gap: 1rem; }
fieldset { min-width: 0; margin: 0; border: 1px solid var(--border); border-radius: 0.4rem; display: grid; gap: 0.5rem; }
.check { display: flex; gap: 0.5rem; align-items: center; }
</style>
