import { createApiClient, forwardedForChain, type ApiFn } from '~/utils/apiClient'


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
  // SSR: forward the browser's IP so per-IP API limits aren't shared site-wide (U10).
  let forwardedFor: string | undefined
  if (import.meta.server) {
    // The address that connected to the UI server (Nitro's h3 v1 event; read defensively).
    const remote = (useRequestEvent() as { node?: { req?: { socket?: { remoteAddress?: string } } } } | undefined)?.node?.req?.socket?.remoteAddress
    forwardedFor = forwardedForChain(useRequestHeaders(['x-forwarded-for'])['x-forwarded-for'], remote) || undefined
  }
  const client = createApiClient({
    fetch: (...args) => globalThis.fetch(...args),
    apiBase: String(config.apiBase).replace(/\/$/, ''),
    siteUrl: String(config.siteUrl).replace(/\/$/, ''),
    isServer: import.meta.server,
    getCookie: () => (import.meta.server ? ssrCookie : document.cookie),
    forwardedFor,
  })
  if (import.meta.client) browserClient = client
  return client
}
