<script setup lang="ts">
import type { Me } from '~/types/api'
import { pollUntil } from '~/utils/pollUntil'
import { acceptFor } from '~/composables/useUploader'
import { ApiError } from '~/utils/apiError'

const props = withDefaults(defineProps<{ kind: 'avatar' | 'banner', interval?: number, timeout?: number }>(), { interval: 2000, timeout: 30000 })

const auth = useAuthStore()
const api = useApi()
const uploader = useUploader()
const uid = useId()
const urlKey = props.kind === 'avatar' ? 'avatar_url' : 'banner_url'
const label = props.kind === 'avatar' ? 'Avatar' : 'Banner'
const phase = ref<'idle' | 'processing' | 'slow' | 'error'>('idle')
const message = ref('')
let unmounted = false
onBeforeUnmount(() => {
  unmounted = true
})

const current = computed(() => auth.me?.[urlKey] ?? null)
const busy = computed(() => uploader.state.value === 'uploading' || uploader.state.value === 'completing' || phase.value === 'processing')

async function onChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  phase.value = 'idle'
  message.value = ''
  try {
    const sessionId = await uploader.upload(file, props.kind)
    const before = auth.me?.[urlKey] ?? null
    await api(`/me/${props.kind}`, { method: 'PUT', body: { upload_session_id: sessionId } })
    phase.value = 'processing'
    const me = await pollUntil(
      async () => (await api<{ data: Me }>('/me')).data,
      m => (m[urlKey] ?? null) !== before,
      { interval: props.interval, timeout: props.timeout, cancelled: () => unmounted },
    )
    if (me) {
      auth.me = me
      phase.value = 'idle'
    }
    else if (!unmounted) phase.value = 'slow'
  }
  catch (err) {
    phase.value = 'error'
    message.value = uploader.state.value === 'error'
      ? uploader.error.value
      : err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
  }
  finally {
    input.value = ''
  }
}
</script>

<template>
  <div class="pimg" :class="`pimg--${kind}`">
    <label :for="`pi-${uid}`">{{ label }}</label>
    <img v-if="current" :src="current" :alt="`Your ${kind}`" class="pimg__preview">
    <p v-else class="hint">
      No {{ kind }} yet.
    </p>
    <input :id="`pi-${uid}`" type="file" :name="kind" :accept="acceptFor(kind)" :disabled="busy" @change="onChange">
    <div v-if="uploader.state.value === 'uploading' || uploader.state.value === 'completing'" class="row">
      <progress :value="uploader.progress.value" max="1" :aria-label="`${label} upload progress`" />
      <span role="status">{{ Math.round(uploader.progress.value * 100) }}%</span>
    </div>
    <p v-else-if="phase === 'processing'" role="status">
      Processing…
    </p>
    <p v-else-if="phase === 'slow'" role="status">
      Still processing — refresh later.
    </p>
    <p v-else-if="phase === 'error'" class="field__error" role="alert">
      {{ message }}
    </p>
  </div>
</template>

<style scoped>
.pimg { display: grid; gap: 0.35rem; justify-items: start; }
label { font-weight: 600; }
.pimg__preview { border: 1px solid var(--border); border-radius: 0.4rem; object-fit: cover; }
.pimg--avatar .pimg__preview { width: 6rem; height: 6rem; border-radius: 50%; }
.pimg--banner .pimg__preview { width: 100%; max-height: 10rem; }
.row { display: flex; gap: 0.5rem; align-items: center; }
.hint { margin: 0; opacity: 0.8; }
.field__error { margin: 0; color: var(--danger); }
</style>
