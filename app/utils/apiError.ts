/** Normalised API failure. status 0 + code `network_error` = no usable HTTP/JSON response. */
export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string[]>
  /** Value of the response's X-Request-Id header, when the browser could read it. */
  requestId?: string

  constructor(status: number, code: string, message: string, fields: Record<string, string[]> = {}, requestId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.requestId = requestId
  }
}

/** Build an ApiError from a parsed body shaped `{ error: { code, message, fields? } }`. */
export function apiErrorFrom(status: number, body: unknown, requestId?: string): ApiError {
  const e = (body as { error?: { code?: string, message?: string, fields?: Record<string, string[]> } } | null)?.error
  if (e && typeof e === 'object') {
    return new ApiError(status, e.code ?? 'http_error', e.message ?? 'Request failed.', e.fields ?? {}, requestId)
  }
  return new ApiError(status, 'http_error', 'Request failed.', {}, requestId)
}

/** The ApiError behind `e`, unwrapping NuxtError `.cause` chains (useAsyncData wraps thrown errors). */
export function apiErrorOf(e: unknown, depth = 0): ApiError | null {
  if (e instanceof ApiError) return e
  if (depth < 5 && e && typeof e === 'object' && 'cause' in e) return apiErrorOf((e as { cause: unknown }).cause, depth + 1)
  return null
}

/** Error-page payload for a failed page load: 404 → "Not found", anything else → "Something went wrong" (U8: carries the request id). */
export function pageErrorFor(e: unknown) {
  const c = apiErrorOf(e)
  const notFound = c?.status === 404
  return {
    statusCode: notFound ? 404 : (c?.status && c.status >= 400 ? c.status : 500),
    statusMessage: notFound ? 'Not found' : 'Something went wrong',
    data: { requestId: c?.requestId },
  }
}
