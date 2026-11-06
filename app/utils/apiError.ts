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
