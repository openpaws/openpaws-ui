import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { clearNuxtData } from '#imports'
import { flushPromises } from '@vue/test-utils'
import { useAuthStore } from '~/stores/auth'
import ImageViewer from '~/components/submission/ImageViewer.vue'
import WritingReader from '~/components/submission/WritingReader.vue'
import AudioPlayer from '~/components/submission/AudioPlayer.vue'
import VideoPlayer from '~/components/submission/VideoPlayer.vue'
import ViewPage from '~/pages/view/[id].vue'
import { json, ME, mockFetch } from '../helpers/mockFetch'
import { sub } from '../helpers/submission'

const ref_ = (url: string, mime = 'x/y') => ({ url, mime, size_bytes: 1 })
const MISSING = 'Media is not available yet.'

beforeEach(() => { useAuthStore().me = null; clearNuxtData() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('viewers', () => {
  it('each type renders its viewer', async () => {
    const img = await mountSuspended(ImageViewer, { props: { submission: sub() } })
    expect(img.get('img').attributes('src')).toBe('https://cdn/p.jpg')
    expect(img.get('a[download]').attributes('href')).toBe('https://cdn/o.png')
    const aud = await mountSuspended(AudioPlayer, { props: { submission: sub({ type: 'audio', media: { transcode: ref_('https://cdn/a.m4a') } }) } })
    expect(aud.get('audio').attributes('src')).toBe('https://cdn/a.m4a')
    const vid = await mountSuspended(VideoPlayer, { props: { submission: sub({ type: 'video', media: { transcode: ref_('https://cdn/v.mp4'), cover: ref_('https://cdn/c.jpg') } }) } })
    expect(vid.get('video').attributes('poster')).toBe('https://cdn/c.jpg')
    expect(vid.get('video').attributes('preload')).toBe('metadata')
    const wr = await mountSuspended(WritingReader, { props: { submission: sub({ type: 'writing', body_html: '<p>Once</p>', media: { document: ref_('https://cdn/d.pdf') } }) } })
    expect(wr.get('[data-testid=reader-body]').html()).toContain('<p>Once</p>')
    expect(wr.text()).toContain('Download document')
  })

  it.each([
    ['image', ImageViewer], ['writing', WritingReader], ['audio', AudioPlayer], ['video', VideoPlayer],
  ] as const)('missing media key shows placeholder for %s', async (type, C) => {
    const w = await mountSuspended(C, { props: { submission: sub({ type, media: {} }) } })
    expect(w.text()).toContain(MISSING)
    expect(w.find('img, audio, video').exists()).toBe(false)
  })

  it('image click toggles full size', async () => {
    const w = await mountSuspended(ImageViewer, { props: { submission: sub() } })
    expect(w.get('img').classes()).toContain('is-fit')
    await w.get('button').trigger('click')
    expect(w.get('img').classes()).toContain('is-full')
  })

  it('audio draws waveform from {peaks} JSON with aria-hidden canvas', async () => {
    mockFetch({})
    vi.stubGlobal('fetch', vi.fn(async () => json({ peaks: [0.1, 0.5, 1] })))
    const w = await mountSuspended(AudioPlayer, { props: { submission: sub({ type: 'audio', media: { transcode: ref_('a'), waveform: ref_('https://cdn/w.json') } }) } })
    await flushPromises()
    expect(w.get('canvas').attributes('aria-hidden')).toBe('true')
    expect(w.get('audio').attributes('controls')).toBeDefined()
  })

  it('writing font size: remembered, and survives disabled storage', async () => {
    const w = await mountSuspended(WritingReader, { props: { submission: sub({ type: 'writing', body_html: '<p>x</p>' }) } })
    await w.get('[aria-label="Larger text"]').trigger('click')
    expect(localStorage.getItem('openpaws:writing-size')).toBe('1')
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    const w2 = await mountSuspended(WritingReader, { props: { submission: sub({ type: 'writing', body_html: '<p>x</p>' }) } })
    await expect(w2.get('[aria-label="Larger text"]').trigger('click')).resolves.not.toThrow()
    spy.mockRestore(); set.mockRestore()
  })
})

describe('view page', () => {
  const route = '/view/s1'
  it('failed shows retry link only for the owner', async () => {
    mockFetch({ 'GET /submissions/s1': () => json({ data: sub({ status: 'failed', media: {} }) }) })
    const guest = await mountSuspended(ViewPage, { route })
    expect(guest.get('[data-testid=status-failed]').exists()).toBe(true)
    expect(guest.find('a[href="/upload?retry=s1"]').exists()).toBe(false)
    useAuthStore().me = ME as never
    const owner = await mountSuspended(ViewPage, { route: '/view/s1?o=1' })
    expect(owner.find('a[href="/upload?retry=s1"]').exists()).toBe(true)
  })

  it('processing polls and swaps to viewer when published; stops on unmount', async () => {
    useAuthStore().me = ME as never
    let status: 'processing' | 'published' = 'processing'
    const f = mockFetch({ 'GET /submissions/s1': () => json({ data: sub({ status, media: status === 'published' ? sub().media : {} }) }) })
    const calls = () => f.mock.calls.filter(([u]) => String(u).endsWith('/submissions/s1')).length
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const w = await mountSuspended(ViewPage, { route: '/view/s1?p=1' })
    expect(w.text()).toContain('Processing…')
    const base = calls()
    status = 'published'
    await vi.advanceTimersByTimeAsync(3100)
    await flushPromises()
    expect(calls()).toBeGreaterThan(base)
    expect(w.find('img').exists()).toBe(true)
    expect(w.text()).not.toContain('Processing…')
    const after = calls()
    await vi.advanceTimersByTimeAsync(10000)
    expect(calls()).toBe(after) // stopped once published
  })

  it('polling stops on unmount', async () => {
    const fn = vi.fn()
    const Host = defineComponent({ setup() { usePoll(() => true, fn); return () => h('div') } })
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const w = await mountSuspended(Host)
    await vi.advanceTimersByTimeAsync(3100)
    expect(fn).toHaveBeenCalledTimes(1)
    w.unmount()
    await vi.advanceTimersByTimeAsync(10000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not poll for guests', async () => {
    const f = mockFetch({ 'GET /submissions/s1': () => json({ data: sub({ status: 'processing', media: {} }) }) })
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    await mountSuspended(ViewPage, { route: '/view/s1?g=1' })
    const n = f.mock.calls.length
    await vi.advanceTimersByTimeAsync(10000)
    expect(f.mock.calls.length).toBe(n)
  })
})
