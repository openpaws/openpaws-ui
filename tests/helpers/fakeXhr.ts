import { vi } from 'vitest'

export interface XhrReply {
  status?: number
  headers?: Record<string, string>
  /** Upload progress events (loaded bytes) fired before the reply. */
  progress?: number[]
  /** Network failure (onerror) instead of a reply. */
  networkError?: boolean
}

/** Decides each request's fate; return null to leave it pending (abort tests). */
export type XhrHandler = (xhr: FakeXHR) => XhrReply | null

export class FakeXHR {
  static instances: FakeXHR[] = []
  static handler: XhrHandler = () => ({ status: 200, headers: { ETag: '"etag"' } })

  method = ''
  url = ''
  body: unknown = null
  requestHeaders: Record<string, string> = {}
  status = 0
  aborted = false
  done = false
  responseHeaders: Record<string, string> = {}
  upload: { onprogress: ((e: { loaded: number, total: number, lengthComputable: boolean }) => void) | null } = { onprogress: null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  setRequestHeader(k: string, v: string) {
    this.requestHeaders[k] = v
  }

  getResponseHeader(k: string): string | null {
    const hit = Object.entries(this.responseHeaders).find(([h]) => h.toLowerCase() === k.toLowerCase())
    return hit ? hit[1] : null
  }

  send(body: unknown) {
    this.body = body
    FakeXHR.instances.push(this)
    const reply = FakeXHR.handler(this)
    if (reply) setTimeout(() => this.reply(reply), 0)
  }

  reply(r: XhrReply) {
    if (this.aborted || this.done) return
    const total = (this.body as Blob | null)?.size ?? 0
    for (const loaded of r.progress ?? []) this.upload.onprogress?.({ loaded, total, lengthComputable: true })
    this.done = true
    if (r.networkError) {
      this.onerror?.()
      return
    }
    this.status = r.status ?? 200
    this.responseHeaders = r.headers ?? {}
    this.onload?.()
  }

  abort() {
    if (this.done) return
    this.aborted = true
    this.done = true
    this.onabort?.()
  }
}

/** Install FakeXHR as the global XMLHttpRequest with a fresh handler. */
export function installFakeXhr(handler?: XhrHandler) {
  FakeXHR.instances = []
  FakeXHR.handler = handler ?? (() => ({ status: 200, headers: { ETag: '"etag"' } }))
  vi.stubGlobal('XMLHttpRequest', FakeXHR)
  return FakeXHR
}

/** A File whose reported size is `size` without allocating it (pre-check tests). */
export function fakeSizedFile(name: string, type: string, size: number): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}
