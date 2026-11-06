<script setup lang="ts">
import type { Folder, Single, Submission, SubmissionType } from '~/types/api'
import type { DetailsForm } from '~/components/upload/DetailsStep.vue'
import { MAIN_KIND, type Uploader, type UploadView } from '~/composables/useUploader'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Upload — OpenPaws' })

type Slot = 'main' | 'cover'

const auth = useAuthStore()
const api = useApi()
const route = useRoute()
const verified = computed(() => auth.me?.email_verified ?? false)

// ── Unverified: resend link ───────────────────────────────────────────────
const resend = useFormError()
const resent = ref(false)
function doResend() {
  return resend.run(async () => {
    await api('/auth/email/resend', { method: 'POST' })
    resent.value = true
  })
}

// ── Retry mode (/upload?retry={id}) ───────────────────────────────────────
const retryId = typeof route.query.retry === 'string' ? route.query.retry : ''
const retryTarget = ref<Submission | null>(null)
const retryError = ref('')
const type = ref<SubmissionType | null>(null)

if (verified.value && retryId) {
  try {
    const s = (await api<Single<Submission>>(`/submissions/${encodeURIComponent(retryId)}`)).data
    if (s.user.username !== auth.me?.username) retryError.value = 'You can only retry your own submissions.'
    else if (s.status !== 'failed') retryError.value = 'This submission does not need a retry.'
    else {
      retryTarget.value = s
      type.value = s.type
    }
  }
  catch {
    retryError.value = 'Could not load that submission.'
  }
}

const folders = ref<Folder[]>([])
if (verified.value && !retryId && auth.me) {
  try {
    folders.value = (await api<{ data: Folder[] }>(`/users/${encodeURIComponent(auth.me.username)}/folders`)).data
  }
  catch {
    // Gallery and Scraps are always offered; custom folders are a bonus.
  }
}

// ── Uploads (start as soon as a file is picked) ───────────────────────────
const uploaders: Record<Slot, Uploader> = { main: useUploader(), cover: useUploader() }
const names = reactive<Record<Slot, string>>({ main: '', cover: '' })
const pending: Record<Slot, Promise<string> | null> = { main: null, cover: null }

function track(slot: Slot, p: Promise<string>) {
  p.catch(() => {}) // shown via the uploader's error; awaited again on publish
  pending[slot] = p
}

function pick(slot: Slot, file: File | null) {
  const u = uploaders[slot]
  if (!file || !type.value) {
    u.reset()
    names[slot] = ''
    pending[slot] = null
    return
  }
  names[slot] = file.name
  track(slot, u.upload(file, slot === 'main' ? MAIN_KIND[type.value] : 'cover'))
}

function resumeSlot(slot: Slot) {
  track(slot, uploaders[slot].resume())
}

watch(type, () => {
  pick('main', null)
  pick('cover', null)
})

const view = (slot: Slot): UploadView => ({
  name: names[slot],
  state: uploaders[slot].state.value,
  progress: uploaders[slot].progress.value,
  error: uploaders[slot].error.value,
})
const mainView = computed(() => view('main'))
const coverView = computed(() => view('cover'))

const busy = (s: string) => s === 'uploading' || s === 'completing'
const uploading = computed(() => busy(mainView.value.state) || busy(coverView.value.state))
useLeaveGuard(() => uploading.value, 'Your upload is still in progress. Leave and cancel it?')

const fileStepReady = computed(() => {
  if (!type.value) return false
  if (mainView.value.state === 'error' || coverView.value.state === 'error') return false
  return type.value === 'writing' || mainView.value.state !== 'idle'
})

const FAILED_UPLOAD = 'An upload did not finish. Go back to the file step and try again.'

/** Wait for the started uploads and return their session ids. */
async function sessionIds(): Promise<{ upload_session_id?: string, cover_upload_session_id?: string }> {
  const ids: { upload_session_id?: string, cover_upload_session_id?: string } = {}
  if (pending.main) ids.upload_session_id = await pending.main
  if (pending.cover) ids.cover_upload_session_id = await pending.cover
  return ids
}

// ── Wizard ────────────────────────────────────────────────────────────────
const step = ref<1 | 2 | 3>(1)
const submissionId = ref('')
const pub = useFormError()
const form = reactive<DetailsForm>({
  title: '', description: '', body: '', rating: null, tags: [], folder: 'gallery', visibility: 'public',
})

async function withSessions(send: (ids: Awaited<ReturnType<typeof sessionIds>>) => Promise<void>) {
  return pub.run(async () => {
    let ids
    try {
      ids = await sessionIds()
    }
    catch {
      pub.message.value = FAILED_UPLOAD
      return
    }
    await send(ids)
  })
}

function publish() {
  return withSessions(async (ids) => {
    const t = type.value!
    const res = await api<Single<Submission>>('/submissions', {
      method: 'POST',
      body: {
        type: t,
        ...ids,
        title: form.title,
        ...(form.description.trim() ? { description: form.description } : {}),
        ...(t === 'writing' ? { body: form.body } : {}),
        rating: form.rating,
        tags: form.tags,
        folder: form.folder,
        visibility: form.visibility,
      },
    })
    submissionId.value = res.data.id
    step.value = 3
  })
}

function retrySubmit() {
  return withSessions(async (ids) => {
    await api(`/submissions/${encodeURIComponent(retryId)}/retry`, { method: 'POST', body: ids })
    submissionId.value = retryId
    step.value = 3
  })
}

const publishStatus = computed(() => pub.pending.value && uploading.value ? 'Waiting for the upload to finish…' : '')
</script>

<template>
  <section class="upload">
    <h1>{{ retryId ? 'Retry upload' : 'Upload' }}</h1>

    <div v-if="!verified" class="notice" role="alert" data-test="unverified">
      <p>Verify your email address to upload.</p>
      <p v-if="resent" role="status">
        A new link has been sent.
      </p>
      <FormErrors :message="resend.message.value" />
      <button type="button" data-test="resend" :disabled="resend.pending.value" @click="doResend">
        Resend verification email
      </button>
    </div>

    <template v-else-if="retryId">
      <p v-if="retryError" role="alert">
        {{ retryError }}
      </p>
      <template v-else-if="retryTarget && step !== 3">
        <p>Choose a new file for “{{ retryTarget.title }}”, then retry processing.</p>
        <UploadFileStep v-model:type="type" locked :main="mainView" :cover="coverView" @pick="pick" @resume="resumeSlot" />
        <FormErrors :message="pub.message.value" />
        <div class="nav">
          <button type="button" data-test="retry-submit" :disabled="!fileStepReady || pub.pending.value" @click="retrySubmit">
            {{ pub.pending.value ? 'Working…' : 'Retry processing' }}
          </button>
          <span v-if="publishStatus" class="hint" role="status">{{ publishStatus }}</span>
        </div>
      </template>
      <UploadProcessingStep v-else-if="step === 3" :id="submissionId" />
    </template>

    <template v-else>
      <p class="hint">
        Step {{ step }} of 3 — {{ step === 1 ? 'file' : step === 2 ? 'details' : 'processing' }}
      </p>
      <template v-if="step === 1">
        <UploadFileStep v-model:type="type" :main="mainView" :cover="coverView" @pick="pick" @resume="resumeSlot" />
        <div class="nav">
          <button type="button" data-test="next" :disabled="!fileStepReady" @click="step = 2">
            Next
          </button>
        </div>
      </template>
      <template v-else-if="step === 2 && type">
        <p v-if="uploading" class="hint" role="status">
          Your file is still uploading ({{ Math.round(mainView.progress * 100) }}%) — you can fill in the details meanwhile.
        </p>
        <UploadDetailsStep
          v-model="form"
          :type="type"
          :adult-confirmed="auth.me?.adult_confirmed ?? false"
          :folders="folders"
          :field-errors="pub.fields.value"
          :message="pub.message.value"
          :pending="pub.pending.value"
          :status="publishStatus"
          @submit="publish"
        >
          <template #actions>
            <button type="button" :disabled="pub.pending.value" @click="step = 1">
              Back
            </button>
          </template>
        </UploadDetailsStep>
      </template>
      <UploadProcessingStep v-else-if="step === 3" :id="submissionId" />
    </template>
  </section>
</template>

<style scoped>
.upload { display: grid; gap: 1rem; max-width: 44rem; min-width: 0; }
.notice { display: grid; gap: 0.5rem; justify-items: start; }
.notice p { margin: 0; }
.nav { display: flex; gap: 0.75rem; align-items: center; }
.hint { margin: 0; opacity: 0.8; }
</style>
