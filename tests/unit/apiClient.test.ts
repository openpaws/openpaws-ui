import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApiClient, setUnauthenticatedHandler } from '~/utils/apiClient'
import { ApiError } from '~/utils/apiError'

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

function setup(opts: { server?: boolean, cookie?: string } = {}) {
  const jar = { value: opts.cookie ?? '' }
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>()
  const client = createApiClient({
    fetch: fetchMock as unknown as typeof fetch,
    apiBase: 'http://api.test',
    siteUrl: 'http://site.test',
    isServer: opts.server ?? false,
    getCookie: () => jar.value,
  })
  return { jar, fetchMock, client }
}
const hdr = (init: RequestInit, k: string) => new Headers(init.headers).get(k)

describe('apiClient', () => {
  const hook = vi.fn()
  beforeEach(() => {
    hook.mockReset()
    setUnauthenticatedHandler(hook)
  })

  it('fetches csrf cookie once before the first POST and sends X-XSRF-TOKEN', async () => {
    const { jar, fetchMock, client } = setup()
    fetchMock.mockImplementation(async (url) => {
      if (url.endsWith('/sanctum/csrf-cookie')) {
        jar.value = 'XSRF-TOKEN=abc%3D%3D'
        return json(null, 204)
      }
      return json({ data: 1 })
    })
    await client('/auth/login', { method: 'POST', body: { a: 1 } })
    await client('/auth/login', { method: 'POST', body: { a: 1 } })
    const urls = fetchMock.mock.calls.map(c => c[0])
    expect(urls.filter(u => u === 'http://api.test/sanctum/csrf-cookie')).toHaveLength(1)
    const post = fetchMock.mock.calls.find(c => c[0] === 'http://api.test/api/v1/auth/login')![1]
    expect(hdr(post, 'X-XSRF-TOKEN')).toBe('abc==')
    expect(hdr(post, 'Accept')).toBe('application/json')
    expect(post.credentials).toBe('include')
    expect(post.body).toBe('{"a":1}')
  })

  it('does not fetch csrf for GET', async () => {
    const { fetchMock, client } = setup()
    fetchMock.mockImplementation(async () => json({ data: [] }))
    await client('/browse', { query: { cursor: 'x', skip: undefined, r: ['a', 'b'] } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]![0]).toBe('http://api.test/api/v1/browse?cursor=x&r=a&r=b')
  })

  it('concurrent first POSTs fetch the csrf cookie once', async () => {
    const { jar, fetchMock, client } = setup()
    fetchMock.mockImplementation(async (url) => {
      if (url.endsWith('/sanctum/csrf-cookie')) {
        await new Promise(r => setTimeout(r, 10))
        jar.value = 'XSRF-TOKEN=t'
        return json(null, 204)
      }
      return json({ data: 1 })
    })
    await Promise.all([client('/a', { method: 'POST' }), client('/b', { method: 'POST' }), client('/c', { method: 'DELETE' })])
    expect(fetchMock.mock.calls.filter(c => c[0].endsWith('/sanctum/csrf-cookie'))).toHaveLength(1)
  })

  it('forwards cookie header, Origin and Referer during SSR', async () => {
    const { fetchMock, client } = setup({ server: true, cookie: 'laravel_session=s; XSRF-TOKEN=x%20y' })
    fetchMock.mockImplementation(async () => json({ data: 1 }))
    await client('/me')
    await client('/folders', { method: 'POST', body: {} })
    const [, get] = fetchMock.mock.calls[0]!
    expect(hdr(get, 'cookie')).toBe('laravel_session=s; XSRF-TOKEN=x%20y')
    expect(hdr(get, 'Origin')).toBe('http://site.test')
    expect(hdr(get, 'Referer')).toBe('http://site.test/')
    const [, post] = fetchMock.mock.calls[1]!
    expect(hdr(post, 'X-XSRF-TOKEN')).toBe('x y')
    expect(fetchMock).toHaveBeenCalledTimes(2) // no csrf fetch needed
  })

  it('maps error shape to ApiError with fields', async () => {
    const { fetchMock, client } = setup()
    fetchMock.mockImplementation(async () => json({ error: { code: 'validation_failed', message: 'Bad', fields: { email: ['taken'] } } }, 422))
    const err = await client('/x').catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 422, code: 'validation_failed', message: 'Bad', fields: { email: ['taken'] } })
    fetchMock.mockImplementation(async () => json({ error: { code: 'not_found', message: 'Not found.' } }, 404))
    expect((await client('/x').catch(e => e)).fields).toEqual({})
  })

  it('ApiError carries the X-Request-Id response header', async () => {
    const { fetchMock, client } = setup()
    fetchMock.mockImplementation(async () => json({ error: { code: 'server_error', message: 'x' } }, 500, { 'X-Request-Id': 'abc-1' }))
    expect((await client('/x').catch(e => e)).requestId).toBe('abc-1')
    fetchMock.mockImplementation(async () => json({ error: { code: 'server_error', message: 'x' } }, 500))
    expect((await client('/x').catch(e => e)).requestId).toBeUndefined()
  })

  it('network / non-JSON errors become status 0 network_error', async () => {
    const { fetchMock, client } = setup()
    fetchMock.mockRejectedValue(new TypeError('boom'))
    expect(await client('/x').catch(e => e)).toMatchObject({ status: 0, code: 'network_error' })
    fetchMock.mockImplementation(async () => new Response('<html>', { status: 502 }))
    expect(await client('/x').catch(e => e)).toMatchObject({ status: 0, code: 'network_error' })
  })

  it('on 419 refetches csrf and retries once, without looping', async () => {
    const { jar, fetchMock, client } = setup({ cookie: 'XSRF-TOKEN=old' })
    let posts = 0
    fetchMock.mockImplementation(async (url) => {
      if (url.endsWith('/sanctum/csrf-cookie')) {
        jar.value = 'XSRF-TOKEN=new'
        return json(null, 204)
      }
      posts++
      return posts === 1 ? json({ error: { code: 'http_error', message: 'CSRF token mismatch.' } }, 419) : json({ data: 'ok' })
    })
    expect(await client('/x', { method: 'POST' })).toEqual({ data: 'ok' })
    expect(posts).toBe(2)
    const retry = fetchMock.mock.calls.at(-1)![1]
    expect(hdr(retry, 'X-XSRF-TOKEN')).toBe('new')

    // second 419 is surfaced, not retried again
    fetchMock.mockReset()
    fetchMock.mockImplementation(async url =>
      url.endsWith('/sanctum/csrf-cookie') ? json(null, 204) : json({ error: { code: 'http_error', message: 'mismatch' } }, 419))
    const err = await client('/x', { method: 'POST' }).catch(e => e)
    expect(err).toMatchObject({ status: 419, code: 'http_error' })
    expect(fetchMock.mock.calls.filter(c => !c[0].endsWith('/sanctum/csrf-cookie'))).toHaveLength(2)
  })

  it('calls the unauthenticated hook on 401 except for GET /me', async () => {
    const { fetchMock, client } = setup()
    fetchMock.mockImplementation(async () => json({ error: { code: 'unauthenticated', message: 'Unauthenticated.' } }, 401))
    await expect(client('/me')).rejects.toMatchObject({ status: 401 })
    expect(hook).not.toHaveBeenCalled()
    await expect(client('/folders')).rejects.toMatchObject({ status: 401 })
    expect(hook).toHaveBeenCalledTimes(1)
  })
})
