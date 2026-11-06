import { vi } from 'vitest'

export const json = (body: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export const ME = {
  id: 1, username: 'kit', display_name: 'Kit', email: 'kit@example.com', email_verified: true,
  adult_confirmed: false, max_rating: 'sfw', role: 'user',
}

type Route = (url: string, init: RequestInit) => Response | Promise<Response>

/** Replace globalThis.fetch; csrf-cookie always succeeds. Unmatched calls 404. */
export function mockFetch(routes: Record<string, Route>) {
  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return json(null, 204)
    const path = url.replace(/^.*\/api\/v1/, '')
    const method = (init.method ?? 'GET').toUpperCase()
    const r = routes[`${method} ${path}`]
    if (!r) return json({ error: { code: 'not_found', message: 'nope' } }, 404)
    return r(url, init)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

export const bodyOf = (fn: ReturnType<typeof mockFetch>, route: string) => {
  const call = fn.mock.calls.find(([u, i]) => `${(i?.method ?? 'GET')} ${u.replace(/^.*\/api\/v1/, '')}` === route)
  return call ? JSON.parse(String(call[1]!.body)) : undefined
}
