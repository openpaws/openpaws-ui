<script setup lang="ts">
import type { Submission } from '~/types/api'

const props = defineProps<{ submission: Submission }>()
const audio = ref<HTMLAudioElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const peaks = ref<number[]>([])
const progress = ref(0)

const src = computed(() => props.submission.media.transcode)
const cover = computed(() => props.submission.media.cover)
const waveUrl = computed(() => props.submission.media.waveform?.url)

function draw() {
  const c = canvas.value
  const ctx = c?.getContext?.('2d')
  if (!c || !ctx || !peaks.value.length) return
  const { width, height } = c
  ctx.clearRect(0, 0, width, height)
  const bar = width / peaks.value.length
  const style = getComputedStyle(c)
  const played = style.getPropertyValue('--accent').trim() || '#5b3fd0'
  const rest = style.getPropertyValue('--muted').trim() || '#888'
  peaks.value.forEach((p, i) => {
    const h = Math.max(1, p * height)
    ctx.fillStyle = i / peaks.value.length <= progress.value ? played : rest
    ctx.fillRect(i * bar, (height - h) / 2, Math.max(1, bar - 0.5), h)
  })
}

async function loadWaveform() {
  peaks.value = []
  if (!waveUrl.value) return
  try {
    const res = await fetch(waveUrl.value)
    if (!res.ok) return
    const body = await res.json()
    const arr = Array.isArray(body) ? body : body?.peaks
    if (Array.isArray(arr)) peaks.value = arr.map(n => Math.min(1, Math.max(0, Number(n) || 0)))
  }
  catch {
    // waveform is decoration; the native controls still work
  }
}

function onTime() {
  const a = audio.value
  progress.value = a && a.duration ? a.currentTime / a.duration : 0
}
function seek(e: MouseEvent) {
  const a = audio.value
  const c = canvas.value
  if (!a || !c || !a.duration) return
  const rect = c.getBoundingClientRect()
  a.currentTime = Math.min(1, Math.max(0, (e.clientX - rect.left) / (rect.width || 1))) * a.duration
}

onMounted(loadWaveform)
watch(waveUrl, loadWaveform)
watch([peaks, progress], () => nextTick(draw))
</script>

<template>
  <div class="audio-player">
    <template v-if="src?.url">
      <img v-if="cover?.url" class="audio-cover" :src="cover.url" :alt="`Cover for ${submission.title}`">
      <canvas
        v-if="peaks.length"
        ref="canvas"
        class="waveform"
        width="1000"
        height="96"
        aria-hidden="true"
        data-testid="waveform"
        @click="seek"
      />
      <audio ref="audio" controls preload="metadata" :src="src.url" @timeupdate="onTime" />
    </template>
    <p v-else class="media-missing" data-testid="media-missing">Media is not available yet.</p>
  </div>
</template>

<style scoped>
.audio-player { display: flex; flex-direction: column; gap: 0.75rem; align-items: center; }
.audio-cover { max-width: min(100%, 24rem); border-radius: 0.5rem; }
.waveform { width: 100%; height: 96px; cursor: pointer; }
audio { width: 100%; }
.media-missing { color: var(--muted); }
</style>
