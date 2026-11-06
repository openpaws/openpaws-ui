import { createApiClient, type ApiFn } from '~/utils/apiClient'


let browserClient: ApiFn | null = null

/**
 * Typed API caller: `const api = useApi(); await api<Single<Me>>('/me')`.
 * Browser: one shared client (shares the CSRF in-flight promise). Server: one per call,
 * forwarding the incoming request's cookie.
 */
export function useApi(): ApiFn {
  if (import.meta.client && browserClient) return browserClient
  const config = useRuntimeConfig().public
  const ssrCookie = import.meta.server ? (useRequestHeaders(['cookie']).cookie ?? '') : ''
  const client = createApiClient({
    fetch: (...args) => globalThis.fetch(...args),
    apiBase: String(config.apiBase).replace(/\/$/, ''),
    siteUrl: String(config.siteUrl).replace(/\/$/, ''),
    isServer: import.meta.server,
    getCookie: () => (import.meta.server ? ssrCookie : document.cookie),
  })
  if (import.meta.client) browserClient = client
  return client
}
