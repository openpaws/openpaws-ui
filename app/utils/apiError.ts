/** Normalised API failure. status 0 + code `network_error` = no usable HTTP/JSON response. */
export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string[]>

  constructor(status: number, code: string, message: string, fields: Record<string, string[]> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

/** Build an ApiError from a parsed body shaped `{ error: { code, message, fields? } }`. */
export function apiErrorFrom(status: number, body: unknown): ApiError {
  const e = (body as { error?: { code?: string, message?: string, fields?: Record<string, string[]> } } | null)?.error
  if (e && typeof e === 'object') {
    return new ApiError(status, e.code ?? 'http_error', e.message ?? 'Request failed.', e.fields ?? {})
  }
  return new ApiError(status, 'http_error', 'Request failed.')
}
