/**
 * Browser → bucket uploads through presigned URLs (POST /uploads, then PUT, then /complete).
 *
 * - Single PUT (≤ multipart threshold): one XHR with `Content-Type` = the declared mime (it is signed).
 * - Multipart: parts run 3 at a time; each part retries up to 3 times (1 s / 3 s / 9 s backoff).
 *   ETags come from the `ETag` response header, which the bucket must expose via CORS
 *   (`ExposeHeaders: ETag`); a missing one fails fast with MULTIPART_ETAG_MESSAGE.
 * - `abort()` aborts in-flight XHRs; `resume()` re-requests URLs only for parts without an ETag
 *   (a single-PUT upload is restarted with a new session, as its URL is only issued at creation).
 */
import type { SubmissionType, UploadKind, UploadSession } from '~/types/api'
import { ApiError } from '~/utils/apiError'
import { THROTTLE_MESSAGE } from '~/composables/useFormError'

const MB = 1024 * 1024

/** Mirrors openpaws-api config/openpaws.php `limits` (bytes). */
export const UPLOAD_LIMITS: Record<UploadKind, number> = {
  image: 50 * MB,
  audio: 200 * MB,
  video: 2048 * MB,
  document: 10 * MB,
  cover: 10 * MB,
  avatar: 10 * MB,
  banner: 10 * MB,
}

const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
/** Mirrors openpaws-api app/Enums/UploadKind.php allowedMimes(). */
export const UPLOAD_MIMES: Record<UploadKind, string[]> = {
  image: IMAGE_MIMES,
  cover: IMAGE_MIMES,
  avatar: IMAGE_MIMES,
  banner: IMAGE_MIMES,
  audio: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/x-flac', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  document: [
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'application/pdf',
  ],
}

const KIND_LABEL: Record<UploadKind, string> = {
  image: 'Images', audio: 'Audio files', video: 'Videos', document: 'Documents',
  cover: 'Cover images', avatar: 'Avatars', banner: 'Banners',
}

export const MULTIPART_ETAG_MESSAGE = 'Upload blocked by storage CORS (ETag not exposed).'
export const CANCELLED_MESSAGE = 'Upload cancelled.'
const RETRY_DELAYS = [1000, 3000, 9000]
const CONCURRENCY = 3

export type UploadState = 'idle' | 'uploading' | 'completing' | 'done' | 'error'

/** Client-side check before any request: null when OK, else the message to show. */
export function checkUploadFile(file: File, kind: UploadKind): string | null {
  if (!UPLOAD_MIMES[kind].includes(file.type)) return 'This file type is not supported here.'
  if (file.size > UPLOAD_LIMITS[kind]) {
    return `This file is too large. ${KIND_LABEL[kind]} can be up to ${Math.round(UPLOAD_LIMITS[kind] / MB)} MB.`
  }
  if (file.size < 1) return 'This file is empty.'
  return null
}

export class UploadError extends Error {
  constructor(message: string, readonly retryable = true) {
    super(message)
    this.name = 'UploadError'
  }
}

function messageFor(e: unknown): string {
  if (e instanceof UploadError) return e.message
  if (e instanceof ApiError) {
    if (e.status === 429) return THROTTLE_MESSAGE
    const first = Object.values(e.fields)[0]?.[0]
    return first ?? e.message
  }
  return 'The upload failed. Please try again.'
}

export interface UploaderOptions {
  /** Backoff sleep; injectable for tests. */
  delay?: (ms: number) => Promise<void>
}

export function useUploader(opts: UploaderOptions = {}) {
  const api = useApi()
  const delay = opts.delay ?? (ms => new Promise<void>(r => setTimeout(r, ms)))

  const progress = ref(0)
  const state = ref<UploadState>('idle')
  const error = ref('')
  const sessionId = ref<string | null>(null)

  let file: File | null = null
  let kind: UploadKind | null = null
  let session: UploadSession | null = null
  const etags = new Map<number, string>()
  const loaded = new Map<number, number>()
  const inflight = new Set<XMLHttpRequest>()
  /** Bumped by abort() and every new run, so stale work from an older run stops. */
  let run = 0

  function setProgress() {
    if (!file?.size) return
    let sum = 0
    for (const v of loaded.values()) sum += v
    progress.value = Math.min(1, sum / file.size)
  }

  function put(url: string, body: Blob, part: number, contentType?: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      inflight.add(xhr)
      const settle = () => inflight.delete(xhr)
      xhr.open('PUT', url)
      if (contentType) xhr.setRequestHeader('Content-Type', contentType)
      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (!e.lengthComputable) return
        loaded.set(part, e.loaded)
        setProgress()
      }
      xhr.onload = () => {
        settle()
        if (xhr.status >= 200 && xhr.status < 300) {
          loaded.set(part, body.size)
          setProgress()
          resolve(xhr.getResponseHeader('ETag'))
        }
        else {
          loaded.set(part, 0)
          reject(new UploadError(`Storage rejected the upload (HTTP ${xhr.status}).`))
        }
      }
      xhr.onerror = () => {
        settle()
        loaded.set(part, 0)
        reject(new UploadError('Network error while uploading.'))
      }
      xhr.onabort = () => {
        settle()
        reject(new UploadError(CANCELLED_MESSAGE, false))
      }
      xhr.send(body)
    })
  }

  function assertCurrent(myRun: number) {
    if (myRun !== run) throw new UploadError(CANCELLED_MESSAGE, false)
  }

  async function putPart(myRun: number, url: string, n: number, s: UploadSession) {
    const size = s.part_size!
    const blob = file!.slice((n - 1) * size, n * size)
    for (let attempt = 0; ; attempt++) {
      assertCurrent(myRun)
      try {
        const etag = await put(url, blob, n)
        if (!etag) throw new UploadError(MULTIPART_ETAG_MESSAGE, false)
        etags.set(n, etag)
        return
      }
      catch (e) {
        const retryable = !(e instanceof UploadError) || e.retryable
        if (!retryable || attempt >= RETRY_DELAYS.length) throw e
        await delay(RETRY_DELAYS[attempt]!)
      }
    }
  }

  async function runMultipart(myRun: number, s: UploadSession) {
    const missing: number[] = []
    for (let n = 1; n <= s.part_count!; n++) if (!etags.has(n)) missing.push(n)
    if (missing.length) {
      const { urls } = await api<{ urls: Record<string, string> }>(`/uploads/${s.id}/parts`, {
        method: 'POST', body: { part_numbers: missing },
      })
      assertCurrent(myRun)
      const queue = [...missing]
      let failure: unknown = null
      const worker = async () => {
        while (queue.length && !failure) {
          const n = queue.shift()!
          try {
            await putPart(myRun, urls[String(n)]!, n, s)
          }
          catch (e) {
            failure ??= e
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))
      if (failure) throw failure
    }
    assertCurrent(myRun)
    state.value = 'completing'
    const parts = [...etags.entries()].sort(([a], [b]) => a - b).map(([part_number, etag]) => ({ part_number, etag }))
    await api(`/uploads/${s.id}/complete`, { method: 'POST', body: { parts } })
  }

  async function runSingle(myRun: number, s: UploadSession) {
    await put(s.url!, file!, 1, file!.type)
    assertCurrent(myRun)
    state.value = 'completing'
    await api(`/uploads/${s.id}/complete`, { method: 'POST' })
  }

  async function execute(fresh: boolean): Promise<string> {
    const myRun = ++run
    error.value = ''
    state.value = 'uploading'
    try {
      if (fresh || !session || !session.multipart) {
        session = null
        sessionId.value = null
        etags.clear()
        loaded.clear()
        progress.value = 0
        const res = await api<{ data: UploadSession }>('/uploads', {
          method: 'POST', body: { kind, filename: file!.name, mime: file!.type, size: file!.size },
        })
        assertCurrent(myRun)
        session = res.data
        sessionId.value = session.id
      }
      if (session.multipart) await runMultipart(myRun, session)
      else await runSingle(myRun, session)
      assertCurrent(myRun)
      progress.value = 1
      state.value = 'done'
      return session.id
    }
    catch (e) {
      // A superseded run (abort() or a newer upload) must not overwrite the current state.
      if (myRun === run) {
        state.value = 'error'
        error.value = messageFor(e)
      }
      throw e instanceof Error ? e : new UploadError(messageFor(e))
    }
  }

  /** Validate, create a session, upload, complete. Resolves with the upload session id. */
  function upload(f: File, k: UploadKind): Promise<string> {
    abortInflight()
    file = f
    kind = k
    const problem = checkUploadFile(f, k)
    if (problem) {
      run++
      session = null
      sessionId.value = null
      progress.value = 0
      state.value = 'error'
      error.value = problem
      return Promise.reject(new UploadError(problem, false))
    }
    return execute(true)
  }

  /** Continue a failed/aborted upload: only parts without an ETag are re-sent. */
  function resume(): Promise<string> {
    if (!file || !kind) return Promise.reject(new UploadError('Nothing to resume.', false))
    if (state.value === 'done' && session) return Promise.resolve(session.id)
    const problem = checkUploadFile(file, kind)
    if (problem) return Promise.reject(new UploadError(problem, false))
    abortInflight() // never two runs at once
    return execute(false)
  }

  function abortInflight() {
    run++
    for (const x of [...inflight]) x.abort()
    inflight.clear()
  }

  function abort() {
    if (state.value !== 'uploading' && state.value !== 'completing') return
    abortInflight()
    state.value = 'error'
    error.value = CANCELLED_MESSAGE
  }

  /** Forget everything (e.g. the user picked a different type). */
  function reset() {
    abortInflight()
    file = null
    kind = null
    session = null
    sessionId.value = null
    etags.clear()
    loaded.clear()
    progress.value = 0
    error.value = ''
    state.value = 'idle'
  }

  if (getCurrentScope()) onScopeDispose(abortInflight)

  return { upload, resume, abort, reset, progress, state, error, sessionId }
}

export type Uploader = ReturnType<typeof useUploader>

/** The upload kind for a submission type's main file (writing: the optional document). */
export const MAIN_KIND: Record<SubmissionType, UploadKind> = {
  image: 'image', writing: 'document', audio: 'audio', video: 'video',
}
/** Types that may add a cover image (the API prohibits one for images). */
export const allowsCover = (t: SubmissionType) => t !== 'image'

/** What the wizard shows for one upload slot. */
export interface UploadView {
  name: string
  state: UploadState
  progress: number
  error: string
}
