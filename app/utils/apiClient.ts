/**
 * Framework-free API client core (wired to Nuxt by composables/useApi.ts).
 *
 * - Paths are passed WITHOUT /api/v1; the CSRF endpoint is at the API root.
 * - Returns raw parsed JSON (`{ data }`, `{ data, meta }`, ...); callers read `.data`.
 * - Errors -> ApiError; network / non-JSON -> status 0, code `network_error`.
 * - CSRF: first non-GET without an XSRF-TOKEN cookie GETs /sanctum/csrf-cookie once
 *   (concurrent callers share the promise). HTTP 419 -> refetch cookie, retry ONCE.
 * - 401 -> handler registered via setUnauthenticatedHandler(fn) (Task 3's auth store
 *   registers it). Not called for the GET /me bootstrap request (a guest is not an error).
 */
import { ApiError, apiErrorFrom } from './apiError'

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, unknown>
}

export interface ApiClientDeps {
  fetch: typeof fetch
  apiBase: string
  siteUrl: string
  isServer: boolean
  /** Cookie string: document.cookie on the client, the forwarded request header on the server. */
  getCookie: () => string
}

let unauthenticatedHandler: (() => void) | null = null
export function setUnauthenticatedHandler(fn: (() => void) | null) {
  unauthenticatedHandler = fn
}

function xsrfFrom(cookie: string): string | undefined {
  const m = /(?:^|;\s*)XSRF-TOKEN=([^;]*)/.exec(cookie)
  if (!m) return undefined
  try {
    return decodeURIComponent(m[1]!)
  }
  catch {
    return m[1]
  }
}

function buildQuery(query?: Record<string, unknown>): string {
  if (!query) return ''
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) v.forEach(i => p.append(k, String(i)))
    else p.append(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export function createApiClient(deps: ApiClientDeps) {
  const { apiBase, siteUrl, isServer } = deps
  let csrfInFlight: Promise<void> | null = null
  /** Server only: token learned from a csrf-cookie response's Set-Cookie. */
  let serverToken: string | undefined

  function baseHeaders(): Record<string, string> {
    const h: Record<string, string> = { Accept: 'application/json' }
    if (isServer) {
      const cookie = deps.getCookie()
      if (cookie) h.cookie = cookie
      h.Origin = siteUrl
      h.Referer = `${siteUrl}/`
    }
    return h
  }

  function currentToken(): string | undefined {
    return xsrfFrom(deps.getCookie()) ?? (isServer ? serverToken : undefined)
  }

  function fetchCsrf(): Promise<void> {
    csrfInFlight ??= (async () => {
      try {
        const res = await deps.fetch(`${apiBase}/sanctum/csrf-cookie`, {
          credentials: 'include',
          headers: baseHeaders(),
        })
        if (isServer) {
          const setCookies = res.headers.getSetCookie?.() ?? []
          serverToken = xsrfFrom(setCookies.map(c => c.split(';')[0]).join('; ')) ?? serverToken
        }
      }
      catch {
        throw new ApiError(0, 'network_error', 'Could not reach the server.')
      }
      finally {
        csrfInFlight = null
      }
    })()
    return csrfInFlight
  }

  async function send(path: string, opts: ApiOptions, method: string): Promise<Response> {
    const headers = baseHeaders()
    let body: BodyInit | undefined
    if (opts.body instanceof FormData) {
      body = opts.body
    }
    else if (opts.body !== undefined) {
      body = JSON.stringify(opts.body)
      headers['Content-Type'] = 'application/json'
    }
    if (method !== 'GET') {
      const token = currentToken()
      if (token) headers['X-XSRF-TOKEN'] = token
    }
    try {
      return await deps.fetch(`${apiBase}/api/v1${path}${buildQuery(opts.query)}`, {
        method,
        headers,
        body,
        credentials: 'include',
      })
    }
    catch {
      throw new ApiError(0, 'network_error', 'Could not reach the server.')
    }
  }

  return async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
    const method = (opts.method ?? 'GET').toUpperCase()
    if (method !== 'GET' && !currentToken()) await fetchCsrf()

    let res = await send(path, opts, method)
    if (res.status === 419 && method !== 'GET') {
      serverToken = undefined
      await fetchCsrf()
      res = await send(path, opts, method)
    }

    let parsed: unknown
    if (res.status !== 204) {
      try {
        parsed = await res.json()
      }
      catch {
        throw new ApiError(0, 'network_error', 'Unexpected response from the server.')
      }
    }

    if (!res.ok) {
      if (res.status === 401 && !(method === 'GET' && path === '/me')) unauthenticatedHandler?.()
      throw apiErrorFrom(res.status, parsed)
    }
    return parsed as T
  }
}

export type ApiFn = ReturnType<typeof createApiClient>
