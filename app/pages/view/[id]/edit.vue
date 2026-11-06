<script setup lang="ts">
import type { Folder, Single, Submission } from '~/types/api'
import type { DetailsForm } from '~/components/upload/DetailsStep.vue'
import { ApiError } from '~/utils/apiError'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Edit submission — OpenPaws' })

const route = useRoute()
const id = String(route.params.id)
const api = useApi()
const auth = useAuthStore()
const toasts = useToasts()

let submission: Submission
try {
  submission = (await api<Single<Submission>>(`/submissions/${encodeURIComponent(id)}`)).data
}
catch (e) {
  const status = e instanceof ApiError ? e.status || 500 : 500
  throw createError({ statusCode: status, statusMessage: status === 404 ? 'Not found' : 'Something went wrong', data: { requestId: e instanceof ApiError ? e.requestId : undefined }, fatal: true })
}

const isOwner = !!auth.me && auth.me.username === submission.user.username

const folders = ref<Folder[]>([])
if (isOwner && auth.me) {
  try {
    folders.value = (await api<{ data: Folder[] }>(`/users/${encodeURIComponent(auth.me.username)}/folders`)).data
  }
  catch {
    // Gallery and Scraps are always offered.
  }
}

const initial: DetailsForm = {
  title: submission.title,
  description: submission.description ?? '',
  body: submission.body ?? '',
  rating: submission.rating,
  tags: [...submission.tags],
  // A submission is in exactly one of gallery/scraps; picking a custom folder adds it there too.
  folder: submission.folders.some(f => f.kind === 'scraps') ? 'scraps' : 'gallery',
  visibility: submission.visibility,
}
const form = reactive<DetailsForm>({ ...initial, tags: [...initial.tags] })
const save = useFormError()
const del = useFormError()

function changes(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (form.title !== initial.title) out.title = form.title
  if (form.description !== initial.description) out.description = form.description.trim() ? form.description : null
  if (submission.type === 'writing' && form.body !== initial.body) out.body = form.body
  if (form.rating !== initial.rating) out.rating = form.rating
  if (form.tags.join(' ') !== initial.tags.join(' ')) out.tags = form.tags
  if (form.folder !== initial.folder) out.folder = form.folder
  if (form.visibility !== initial.visibility) out.visibility = form.visibility
  return out
}

function onSave() {
  return save.run(async () => {
    const body = changes()
    if (Object.keys(body).length) {
      await api(`/submissions/${encodeURIComponent(id)}`, { method: 'PATCH', body })
      toasts.push('Changes saved.')
    }
    await navigateTo(`/view/${id}`)
  })
}

function onDelete() {
  if (!window.confirm(`Delete “${submission.title}”? This cannot be undone.`)) return
  return del.run(async () => {
    await api(`/submissions/${encodeURIComponent(id)}`, { method: 'DELETE' })
    toasts.push('Submission deleted.')
    await navigateTo(`/user/${encodeURIComponent(auth.me!.username)}/gallery`)
  })
}
</script>

<template>
  <section class="edit">
    <h1>Edit submission</h1>
    <p v-if="!isOwner" role="alert">
      You can only edit your own submissions.
    </p>
    <template v-else>
      <UploadDetailsStep
        v-model="form"
        :type="submission.type"
        :adult-confirmed="auth.me?.adult_confirmed ?? false"
        :folders="folders"
        :field-errors="save.fields.value"
        :message="save.message.value"
        :pending="save.pending.value"
        submit-label="Save changes"
        @submit="onSave"
      >
        <template #actions>
          <NuxtLink :to="`/view/${id}`">
            Cancel
          </NuxtLink>
        </template>
      </UploadDetailsStep>

      <section class="danger" aria-labelledby="danger-h">
        <h2 id="danger-h">
          Delete
        </h2>
        <FormErrors :message="del.message.value" />
        <button type="button" data-test="delete" class="danger__btn" :disabled="del.pending.value" @click="onDelete">
          {{ del.pending.value ? 'Deleting…' : 'Delete submission' }}
        </button>
      </section>
    </template>
  </section>
</template>

<style scoped>
.edit { display: grid; gap: 1.5rem; max-width: 44rem; min-width: 0; }
.danger { display: grid; gap: 0.5rem; justify-items: start; border-top: 1px solid var(--border); padding-top: 1rem; }
.danger h2 { margin: 0; }
.danger__btn { color: var(--danger); border-color: var(--danger); }
</style>
