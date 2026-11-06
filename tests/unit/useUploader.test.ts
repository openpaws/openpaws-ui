import { describe, it, expect, vi, beforeEach } from 'vitest'
import { watch } from 'vue'
import { useUploader, checkUploadFile, MULTIPART_ETAG_MESSAGE } from '~/composables/useUploader'
import { bodyOf, json, mockFetch } from '../helpers/mockFetch'
import { fakeSizedFile, installFakeXhr, type FakeXHR } from '../helpers/fakeXhr'

const MB = 1024 * 1024
const single = (over = {}) => json({ data: { id: 'u1', kind: 'image', status: 'pending', multipart: false, url: 'https://s3/put?sig', expires_at: 'x', ...over } }, 201)
const multi = () => json({ data: { id: 'm1', kind: 'video', status: 'pending', multipart: true, part_size: 5, part_count: 3, expires_at: 'x' } }, 201)
const partUrls = (_u: string, init: RequestInit) => {
  const nums = JSON.parse(String(init.body)).part_numbers as number[]
  return json({ urls: Object.fromEntries(nums.map(n => [String(n), `https://s3/part?n=${n}`])) })
}
const partNo = (x: FakeXHR) => Number(new URL(x.url).searchParams.get('n'))
const videoFile = () => new File(['aaaaabbbbbccc'.slice(0, 12)], 'v.mp4', { type: 'video/mp4' })

describe('useUploader', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('single PUT reports progress and completes', async () => {
    const f = mockFetch({
      'POST /uploads': () => single(),
      'POST /uploads/u1/complete': () => json({ id: 'u1', status: 'uploaded' }),
    })
    const seen: number[] = []
    const X = installFakeXhr(() => ({ status: 200, progress: [2, 4] }))
    const up = useUploader()
    watch(up.progress, v => seen.push(v), { flush: 'sync' })
    const file = new File(['12345678'], 'a.png', { type: 'image/png' })
    const id = await up.upload(file, 'image')

    expect(id).toBe('u1')
    expect(bodyOf(f, 'POST /uploads')).toEqual({ kind: 'image', filename: 'a.png', mime: 'image/png', size: 8 })
    const x = X.instances[0]!
    expect(x.method).toBe('PUT')
    expect(x.url).toBe('https://s3/put?sig')
    expect(x.requestHeaders['Content-Type']).toBe('image/png')
    expect(x.body).toBe(file)
    expect(seen).toEqual(expect.arrayContaining([0.25, 0.5, 1]))
    expect(f.mock.calls.some(([u, i]) => String(u).endsWith('/uploads/u1/complete') && i?.method === 'POST')).toBe(true)
    expect(up.state.value).toBe('done')
    expect(up.progress.value).toBe(1)
  })

  it('multipart retries a failing part 3 times then errors; resume uploads only missing parts', async () => {
    const f = mockFetch({
      'POST /uploads': () => multi(),
      'POST /uploads/m1/parts': partUrls,
      'POST /uploads/m1/complete': () => json({ id: 'm1', status: 'uploaded' }),
    })
    let failPart2 = true
    const X = installFakeXhr(x => (partNo(x) === 2 && failPart2) ? { status: 500 } : { status: 200, headers: { ETag: `"e${partNo(x)}"` } })
    const delays: number[] = []
    const up = useUploader({ delay: async (ms) => { delays.push(ms) } })

    await expect(up.upload(videoFile(), 'video')).rejects.toThrow()
    expect(X.instances.filter(x => partNo(x) === 2)).toHaveLength(4) // 1 try + 3 retries
    expect(delays).toEqual([1000, 3000, 9000])
    expect(up.state.value).toBe('error')
    expect(up.error.value).not.toBe('')
    expect(f.mock.calls.some(([u]) => String(u).endsWith('/complete'))).toBe(false)

    // Part bodies are the right slices.
    const p3 = X.instances.find(x => partNo(x) === 3)!
    expect((p3.body as Blob).size).toBe(2)

    failPart2 = false
    const before = X.instances.length
    const id = await up.resume()
    expect(id).toBe('m1')
    const partCalls = f.mock.calls.filter(([u]) => String(u).endsWith('/uploads/m1/parts'))
    expect(JSON.parse(String(partCalls[1]![1]!.body))).toEqual({ part_numbers: [2] })
    const resumed = X.instances.slice(before)
    expect(resumed.map(partNo)).toEqual([2])
    expect(bodyOf(f, 'POST /uploads/m1/complete')).toEqual({
      parts: [{ part_number: 1, etag: '"e1"' }, { part_number: 2, etag: '"e2"' }, { part_number: 3, etag: '"e3"' }],
    })
    expect(up.state.value).toBe('done')
  })

  it('multipart runs at most 3 parts at once and abort() cancels in-flight XHRs', async () => {
    mockFetch({
      'POST /uploads': () => json({ data: { id: 'm1', kind: 'video', status: 'pending', multipart: true, part_size: 2, part_count: 6, expires_at: 'x' } }, 201),
      'POST /uploads/m1/parts': partUrls,
    })
    const X = installFakeXhr(() => null) // never answer
    const up = useUploader({ delay: async () => {} })
    const p = up.upload(new File(['abcdefghijkl'], 'v.mp4', { type: 'video/mp4' }), 'video')
    const caught = p.catch(e => e)
    await vi.waitFor(() => expect(X.instances).toHaveLength(3))
    await new Promise(r => setTimeout(r, 10))
    expect(X.instances).toHaveLength(3)
    expect(up.state.value).toBe('uploading')
    up.abort()
    expect(X.instances.every(x => x.aborted)).toBe(true)
    const err = await caught
    expect(err).toBeInstanceOf(Error)
    expect(up.state.value).toBe('error')
    expect(up.error.value).toBe('Upload cancelled.')
    await new Promise(r => setTimeout(r, 10))
    expect(X.instances).toHaveLength(3) // nothing new started after abort
  })

  it('multipart PUT without a readable ETag fails with the CORS message (no retries)', async () => {
    mockFetch({
      'POST /uploads': () => multi(),
      'POST /uploads/m1/parts': partUrls,
    })
    installFakeXhr(() => ({ status: 200, headers: {} }))
    const delays: number[] = []
    const up = useUploader({ delay: async (ms) => { delays.push(ms) } })
    await expect(up.upload(videoFile(), 'video')).rejects.toThrow(MULTIPART_ETAG_MESSAGE)
    expect(MULTIPART_ETAG_MESSAGE).toBe('Upload blocked by storage CORS (ETag not exposed).')
    expect(up.error.value).toBe(MULTIPART_ETAG_MESSAGE)
    expect(delays).toEqual([])
  })

  it('client pre-check rejects oversize and wrong-type files before any request', async () => {
    const f = mockFetch({})
    installFakeXhr()
    expect(checkUploadFile(fakeSizedFile('a.png', 'image/png', 51 * MB), 'image')).toBe('This file is too large. Images can be up to 50 MB.')
    expect(checkUploadFile(fakeSizedFile('a.png', 'image/png', 50 * MB), 'image')).toBeNull()
    expect(checkUploadFile(new File(['x'], 'a.exe', { type: 'application/x-msdownload' }), 'image')).toBe('This file type is not supported here.')
    const up = useUploader()
    await expect(up.upload(fakeSizedFile('a.png', 'image/png', 51 * MB), 'image')).rejects.toThrow('This file is too large. Images can be up to 50 MB.')
    expect(up.state.value).toBe('error')
    expect(f).not.toHaveBeenCalled()
  })

  it('API errors become a readable message', async () => {
    mockFetch({
      'POST /uploads': () => json({ error: { code: 'quota_exceeded', message: 'Daily upload limit reached.' } }, 422),
    })
    installFakeXhr()
    const up = useUploader()
    await expect(up.upload(new File(['x'], 'a.png', { type: 'image/png' }), 'image')).rejects.toThrow()
    expect(up.error.value).toBe('Daily upload limit reached.')
  })
})
