<script setup lang="ts">
import type { Folder, Rating, SubmissionType, Visibility } from '~/types/api'

export interface DetailsForm {
  title: string
  description: string
  body: string
  rating: Rating | null
  tags: string[]
  /** 'gallery' | 'scraps' | a custom folder id. */
  folder: string
  visibility: Visibility
}

const props = withDefaults(defineProps<{
  type: SubmissionType
  adultConfirmed: boolean
  folders: Folder[]
  fieldErrors?: Record<string, string[]>
  message?: string
  pending?: boolean
  submitLabel?: string
  /** Shown beside the submit button (e.g. "Waiting for the upload to finish…"). */
  status?: string
}>(), { fieldErrors: () => ({}), message: '', pending: false, submitLabel: 'Publish', status: '' })
const emit = defineEmits<{ submit: [] }>()
const form = defineModel<DetailsForm>({ required: true })

const ratingMissing = ref(false)
const err = (name: string) => props.fieldErrors[name]?.[0]
const ratings: { value: Rating, label: string, needsAdult: boolean }[] = [
  { value: 'general', label: 'General', needsAdult: false },
  { value: 'mature', label: 'Mature', needsAdult: true },
  { value: 'adult', label: 'Adult', needsAdult: true },
]
const customFolders = computed(() => props.folders.filter(f => f.kind === 'custom'))

watch(() => form.value.rating, (r) => {
  if (r) ratingMissing.value = false
})

function onSubmit() {
  if (!form.value.rating) {
    ratingMissing.value = true
    return
  }
  emit('submit')
}
</script>

<template>
  <form class="details" data-test="details-form" novalidate @submit.prevent="onSubmit">
    <FormErrors :message="message" />
    <FormTextField v-model="form.title" name="title" label="Title" required :error="err('title')" />
    <div class="field">
      <label for="d-description">Description</label>
      <textarea id="d-description" v-model="form.description" name="description" rows="4" maxlength="20000" />
      <p v-if="err('description')" class="field__error">
        {{ err('description') }}
      </p>
    </div>
    <div v-if="type === 'writing'" class="field">
      <label for="d-body">Text (Markdown)</label>
      <textarea id="d-body" v-model="form.body" name="body" rows="16" maxlength="500000" required />
      <p v-if="err('body')" class="field__error">
        {{ err('body') }}
      </p>
    </div>

    <fieldset :aria-invalid="ratingMissing || err('rating') ? 'true' : undefined">
      <legend>Rating (required)</legend>
      <label v-for="r in ratings" :key="r.value" class="check">
        <input
          v-model="form.rating"
          type="radio"
          name="rating"
          :value="r.value"
          :disabled="r.needsAdult && !adultConfirmed"
        >
        <RatingBadge :rating="r.value" /> {{ r.label }}
      </label>
      <p v-if="!adultConfirmed" class="hint">
        Confirm you are 18+ in Settings to use this rating.
      </p>
      <p v-if="ratingMissing" class="field__error" role="alert">
        Choose a rating.
      </p>
      <p v-else-if="err('rating')" class="field__error">
        {{ err('rating') }}
      </p>
    </fieldset>

    <UploadTagInput v-model="form.tags" :error="err('tags')" />

    <div class="field">
      <label for="d-folder">Folder</label>
      <select id="d-folder" v-model="form.folder" name="folder">
        <option value="gallery">
          Gallery
        </option>
        <option value="scraps">
          Scraps
        </option>
        <option v-for="f in customFolders" :key="f.id" :value="f.id">
          {{ f.name }}
        </option>
      </select>
      <p v-if="err('folder')" class="field__error">
        {{ err('folder') }}
      </p>
    </div>

    <fieldset>
      <legend>Visibility</legend>
      <label class="check"><input v-model="form.visibility" type="radio" name="visibility" value="public"> Public</label>
      <label class="check"><input v-model="form.visibility" type="radio" name="visibility" value="unlisted"> Unlisted (only people with the link)</label>
    </fieldset>

    <div class="actions">
      <slot name="actions" />
      <button type="submit" :disabled="pending">
        {{ pending ? 'Working…' : submitLabel }}
      </button>
      <span v-if="status" class="hint" role="status">{{ status }}</span>
    </div>
  </form>
</template>

<style scoped>
.details { display: grid; gap: 0.9rem; min-width: 0; }
.field { display: grid; gap: 0.25rem; }
label { font-weight: 600; }
fieldset { min-width: 0; margin: 0; border: 1px solid var(--border); border-radius: 0.4rem; display: grid; gap: 0.5rem; }
fieldset[aria-invalid='true'] { border-color: var(--danger); }
.check { display: flex; gap: 0.5rem; align-items: center; font-weight: normal; }
textarea, select { font: inherit; padding: 0.5rem 0.65rem; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 0.4rem; width: 100%; box-sizing: border-box; }
.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
.hint { margin: 0; opacity: 0.8; }
.field__error { margin: 0; color: var(--danger); font-size: 0.9rem; }
</style>
