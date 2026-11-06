import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { useAuthStore } from '~/stores/auth'
import UploadPage from '~/pages/upload.vue'
import EditPage from '~/pages/view/[id]/edit.vue'
import ProcessingStep from '~/components/upload/ProcessingStep.vue'
import DetailsStep from '~/components/upload/DetailsStep.vue'
import TagInput from '~/components/upload/TagInput.vue'
import { bodyOf, json, ME, mockFetch } from '../helpers/mockFetch'
import { sub } from '../helpers/submission'
import { fakeSizedFile, installFakeXhr } from '../helpers/fakeXhr'

const { navigateToMock } = vi.hoisted(() => ({ navigateToMock: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateToMock)

const MB = 1024 * 1024
const FOLDERS = [
  { id: 'g1', name: 'Gallery', description: null, kind: 'gallery', position: 0, count: 0 },
  { id: 's1', name: 'Scraps', description: null, kind: 'scraps', position: 1, count: 0 },
  { id: 'c1', name: 'Foxes', description: null, kind: 'custom', position: 2, count: 0 },
]
const uploadRoutes = () => ({
  'GET /users/kit/folders': () => json({ data: FOLDERS }),
  'POST /uploads': (_u: string, init: RequestInit) => {
    const b = JSON.parse(String(init.body))
    const id = b.kind === 'cover' ? 'c-up' : 'u1'
    return json({ data: { id, kind: b.kind, status: 'pending', multipart: false, url: `https://s3/${id}`, expires_at: 'x' } }, 201)
  },
  'POST /uploads/u1/complete': () => json({ id: 'u1', status: 'uploaded' }),
  'POST /uploads/c-up/complete': () => json({ id: 'c-up', status: 'uploaded' }),
  'POST /submissions': () => json({ data: sub({ id: 'n1', status: 'processing' }) }, 201),
  'GET /submissions/n1': () => json({ data: sub({ id: 'n1', status: 'processing' }) }),
})

function setMe(over: Record<string, unknown> = {}) {
  useAuthStore().me = { ...ME, ...over } as never
}

async function pickFile(w: VueWrapper, name: string, file: File) {
  const input = w.get(`input[type="file"][name="${name}"]`)
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

async function chooseType(w: VueWrapper, type: string) {
  await w.get(`input[name="type"][value="${type}"]`).setValue(true)
}

describe('upload wizard', () => {
  beforeEach(() => {
    navigateToMock.mockReset()
    vi.unstubAllGlobals()
    installFakeXhr()
    setMe()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('unverified user sees the verify notice and cannot start an upload', async () => {
    setMe({ email_verified: false })
    const f = mockFetch({ 'POST /auth/email/resend': () => json(null, 204) })
    const w = await mountSuspended(UploadPage, { route: '/upload' })
    await flushPromises()
    expect(w.text()).toContain('Verify your email address to upload.')
    expect(w.find('input[name="type"]').exists()).toBe(false)
    expect(w.find('input[type="file"]').exists()).toBe(false)
    await w.get('button[data-test="resend"]').trigger('click')
    await flushPromises()
    expect(f.mock.calls.some(([u, i]) => String(u).endsWith('/auth/email/resend') && i?.method === 'POST')).toBe(true)
    expect(w.text()).toContain('A new link has been sent.')
  })

  it('client pre-check blocks a 51 MB image with the limit message', async () => {
    const f = mockFetch(uploadRoutes())
    const w = await mountSuspended(UploadPage, { route: '/upload' })
    await chooseType(w, 'image')
    await pickFile(w, 'file', fakeSizedFile('big.png', 'image/png', 51 * MB))
    expect(w.text()).toContain('Upload failed — This file is too large. Images can be up to 50 MB.')
    expect(w.get('button[data-test="resume"]').text()).toBe('Retry')
    expect(f.mock.calls.some(([u]) => String(u).endsWith('/uploads'))).toBe(false)
    expect(w.get('button[data-test="next"]').attributes('disabled')).toBeDefined()
  })

  it('rating must be chosen before publish', async () => {
    const f = mockFetch(uploadRoutes())
    const w = await mountSuspended(UploadPage, { route: '/upload' })
    await chooseType(w, 'writing')
    await w.get('button[data-test="next"]').trigger('click')
    await flushPromises()
    await w.get('input[name="title"]').setValue('My story')
    await w.get('textarea[name="body"]').setValue('# Once upon a time')
    expect(w.findAll('input[name="rating"]').every(r => !(r.element as HTMLInputElement).checked)).toBe(true)
    await w.get('form[data-test="details-form"]').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Choose a rating.')
    expect(bodyOf(f, 'POST /submissions')).toBeUndefined()

    await w.get('input[name="rating"][value="general"]').setValue(true)
    await w.get('form[data-test="details-form"]').trigger('submit')
    await flushPromises()
    const body = bodyOf(f, 'POST /submissions')
    expect(body).toMatchObject({ type: 'writing', title: 'My story', body: '# Once upon a time', rating: 'general', visibility: 'public', folder: 'gallery', tags: [] })
    expect(body).not.toHaveProperty('upload_session_id')
    expect(w.find('[data-test="processing"]').exists()).toBe(true)
  })

  it('image upload starts immediately and its session is used on publish', async () => {
    const f = mockFetch(uploadRoutes())
    const X = installFakeXhr()
    const w = await mountSuspended(UploadPage, { route: '/upload' })
    await chooseType(w, 'image')
    expect(w.find('input[name="cover"]').exists()).toBe(false)
    await pickFile(w, 'file', new File(['png'], 'a.png', { type: 'image/png' }))
    expect(X.instances).toHaveLength(1)
    await w.get('button[data-test="next"]').trigger('click')
    await flushPromises()
    expect(w.find('textarea[name="body"]').exists()).toBe(false)
    await w.get('input[name="title"]').setValue('Fox')
    await w.get('input[name="rating"][value="general"]').setValue(true)
    await w.get('select[name="folder"]').setValue('c1')
    await w.get('input[name="visibility"][value="unlisted"]').setValue(true)
    await w.get('form[data-test="details-form"]').trigger('submit')
    await flushPromises()
    expect(bodyOf(f, 'POST /submissions')).toMatchObject({ type: 'image', upload_session_id: 'u1', title: 'Fox', rating: 'general', folder: 'c1', visibility: 'unlisted' })
  })

  it('audio can add a cover; both sessions are sent', async () => {
    const f = mockFetch(uploadRoutes())
    const w = await mountSuspended(UploadPage, { route: '/upload' })
    await chooseType(w, 'audio')
    await pickFile(w, 'file', new File(['mp3'], 'a.mp3', { type: 'audio/mpeg' }))
    await pickFile(w, 'cover', new File(['jpg'], 'c.jpg', { type: 'image/jpeg' }))
    await w.get('button[data-test="next"]').trigger('click')
    await flushPromises()
    await w.get('input[name="title"]').setValue('Song')
    await w.get('input[name="rating"][value="general"]').setValue(true)
    await w.get('form[data-test="details-form"]').trigger('submit')
    await flushPromises()
    expect(bodyOf(f, 'POST /submissions')).toMatchObject({ type: 'audio', upload_session_id: 'u1', cover_upload_session_id: 'c-up' })
  })

  it('leaving during upload asks for confirmation', async () => {
    mockFetch(uploadRoutes())
    const X = installFakeXhr(() => null) // the PUT stays in flight
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    const w = await mountSuspended(UploadPage, { route: '/upload' })
    const router = useRouter()
    await chooseType(w, 'video')
    await pickFile(w, 'file', new File(['mp4'], 'v.mp4', { type: 'video/mp4' }))
    expect(X.instances).toHaveLength(1)

    const start = router.currentRoute.value.fullPath
    await router.push('/search')
    expect(confirm).toHaveBeenCalledWith('Your upload is still in progress. Leave and cancel it?')
    expect(router.currentRoute.value.fullPath).toBe(start)

    const ev = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)

    // Once the upload is finished the guard is off.
    X.instances[0]!.reply({ status: 200 })
    await flushPromises()
    await vi.waitFor(() => expect(w.text()).toContain('Uploaded'))
    confirm.mockClear()
    const ev2 = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(ev2)
    expect(ev2.defaultPrevented).toBe(false)
    await router.push('/search')
    expect(confirm).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/search')
    w.unmount()
  })

  it('retry reuses the file step and calls the retry endpoint', async () => {
    const f = mockFetch({
      ...uploadRoutes(),
      'GET /submissions/s9': () => json({ data: sub({ id: 's9', type: 'image', status: 'failed', title: 'Broken' }) }),
      'POST /submissions/s9/retry': () => json({ data: sub({ id: 's9', status: 'processing' }) }),
    })
    const w = await mountSuspended(UploadPage, { route: '/upload?retry=s9' })
    await flushPromises()
    expect(w.text()).toContain('Broken')
    expect(w.find('input[name="type"]').exists()).toBe(false)
    await pickFile(w, 'file', new File(['png'], 'a.png', { type: 'image/png' }))
    await w.get('button[data-test="retry-submit"]').trigger('click')
    await flushPromises()
    expect(bodyOf(f, 'POST /submissions/s9/retry')).toEqual({ upload_session_id: 'u1' })
    expect(w.find('[data-test="processing"]').exists()).toBe(true)
  })
})

describe('upload retry from the processing-failed step (I3)', () => {
  beforeEach(() => {
    navigateToMock.mockReset()
    vi.unstubAllGlobals()
    installFakeXhr()
    // Earlier tests leave wizard instances mounted; their leave guards must not block these pushes.
    vi.stubGlobal('confirm', () => true)
    setMe()
  })
  afterEach(() => vi.unstubAllGlobals())

  const retryRoutes = () => ({
    ...uploadRoutes(),
    'GET /submissions/s9': () => json({ data: sub({ id: 's9', type: 'image', status: 'failed', title: 'Broken' }) }),
    'POST /submissions/s9/retry': () => json({ data: sub({ id: 's9', status: 'processing' }) }),
  })

  it('/upload → /upload?retry=s9 in the same page instance enters retry mode on a fresh step', async () => {
    const f = mockFetch({ ...retryRoutes(), 'GET /submissions/n1': () => json({ data: sub({ id: 'n1', status: 'failed' }) }) })
    const w = await mountSuspended(UploadPage, { route: '/upload' })
    await flushPromises()
    await chooseType(w, 'image')
    await pickFile(w, 'file', new File(['png'], 'a.png', { type: 'image/png' }))
    await w.get('button[data-test="next"]').trigger('click')
    await w.get('input[name="title"]').setValue('T')
    await w.get('input[name="rating"][value="general"]').setValue(true)
    await w.get('form').trigger('submit')
    await vi.waitFor(() => expect(w.find('[data-test="processing"]').exists()).toBe(true))

    await useRouter().push('/upload?retry=s9')
    await flushPromises()
    expect(w.find('[data-test="processing"]').exists()).toBe(false)
    expect(w.get('h1').text()).toBe('Retry upload')
    expect(w.text()).toContain('Broken')
    expect(w.find('button[data-test="retry-submit"]').exists()).toBe(true)
    expect(w.find('button[data-test="retry-submit"]').attributes('disabled')).toBeDefined()
    await pickFile(w, 'file', new File(['png'], 'b.png', { type: 'image/png' }))
    await w.get('button[data-test="retry-submit"]').trigger('click')
    await vi.waitFor(() => expect(bodyOf(f, 'POST /submissions/s9/retry')).toEqual({ upload_session_id: 'u1' }))
    await vi.waitFor(() => expect(w.find('[data-test="processing"]').exists()).toBe(true))
    w.unmount()
  })

  it('Retry link to the URL already shown (/upload?retry=s9) resets to the file step', async () => {
    mockFetch(retryRoutes())
    await useRouter().push('/upload?retry=s9')
    const w = await mountSuspended(UploadPage, { route: '/upload?retry=s9' })
    await flushPromises()
    await pickFile(w, 'file', new File(['png'], 'a.png', { type: 'image/png' }))
    await w.get('button[data-test="retry-submit"]').trigger('click')
    await vi.waitFor(() => expect(w.find('[data-test="processing"]').exists()).toBe(true))

    w.findComponent(ProcessingStep).vm.$emit('retry', 's9')
    await flushPromises()
    expect(w.find('[data-test="processing"]').exists()).toBe(false)
    expect(w.text()).toContain('Broken')
    expect(w.get('button[data-test="retry-submit"]').attributes('disabled')).toBeDefined()
    w.unmount()
  })
})

describe('DetailsStep', () => {
  const form = () => ({ title: '', description: '', body: '', rating: null, tags: [], folder: 'gallery', visibility: 'public' })

  it('mature and adult are disabled until 18+ is confirmed', async () => {
    const w = await mountSuspended(DetailsStep, { props: { modelValue: form(), type: 'image', adultConfirmed: false, folders: FOLDERS } })
    expect(w.get('input[name="rating"][value="general"]').attributes('disabled')).toBeUndefined()
    expect(w.get('input[name="rating"][value="mature"]').attributes('disabled')).toBeDefined()
    expect(w.get('input[name="rating"][value="adult"]').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Confirm you are 18+ in Settings to use this rating.')

    const ok = await mountSuspended(DetailsStep, { props: { modelValue: form(), type: 'image', adultConfirmed: true, folders: FOLDERS } })
    expect(ok.get('input[name="rating"][value="adult"]').attributes('disabled')).toBeUndefined()
    expect(ok.text()).not.toContain('Confirm you are 18+')
  })
})

describe('TagInput', () => {
  it('autocompletes, adds chips and stops at 60', async () => {
    mockFetch({ 'GET /tags/autocomplete?q=fo': () => json({ data: [{ slug: 'fox', usage_count: 9 }, { slug: 'forest', usage_count: 2 }] }) })
    const w = await mountSuspended(TagInput, { props: { modelValue: [], debounce: 0, 'onUpdate:modelValue': (v: string[]) => w.setProps({ modelValue: v }) } })
    await w.get('input[name="tag"]').setValue('fo')
    await vi.waitFor(() => expect(w.text()).toContain('forest'))
    await w.get('[data-test="suggestion"]').trigger('mousedown')
    expect(w.props('modelValue')).toEqual(['fox'])
    await w.get('input[name="tag"]').setValue('Red Panda')
    await w.get('input[name="tag"]').trigger('keydown', { key: 'Enter' })
    expect(w.props('modelValue')).toEqual(['fox', 'red_panda'])
    expect(w.findAll('[data-test="chip"]')).toHaveLength(2)
    await w.get('[data-test="chip"] button').trigger('click')
    expect(w.props('modelValue')).toEqual(['red_panda'])

    await w.setProps({ modelValue: Array.from({ length: 60 }, (_, i) => `t${i}`) })
    expect(w.get('input[name="tag"]').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('60 tags maximum.')
  })
})

describe('ProcessingStep', () => {
  beforeEach(() => navigateToMock.mockReset())

  it('processing step redirects on published and shows retry on failed', async () => {
    let n = 0
    mockFetch({ 'GET /submissions/p1': () => json({ data: sub({ id: 'p1', status: ++n < 2 ? 'processing' : 'published' }) }) })
    const w = await mountSuspended(ProcessingStep, { props: { id: 'p1', interval: 5 } })
    expect(w.text()).toContain('Processing')
    await vi.waitFor(() => expect(navigateToMock).toHaveBeenCalledWith('/view/p1'))

    mockFetch({ 'GET /submissions/p2': () => json({ data: sub({ id: 'p2', status: 'failed' }) }) })
    const f = await mountSuspended(ProcessingStep, { props: { id: 'p2', interval: 5 } })
    await vi.waitFor(() => expect(f.text()).toContain('Processing failed'))
    expect(f.get('a[href="/upload?retry=p2"]').text()).toContain('Retry')
    expect(navigateToMock).not.toHaveBeenCalledWith('/view/p2')
  })
})

describe('edit page', () => {
  const owned = () => sub({ id: 's1', type: 'writing', title: 'Old', body: 'old body', rating: 'general', tags: ['fox'], folders: [{ id: 'g1', name: 'Gallery', kind: 'gallery' }] })

  beforeEach(() => {
    navigateToMock.mockReset()
    vi.unstubAllGlobals()
    setMe()
  })

  it('PATCHes only the changed fields', async () => {
    const f = mockFetch({
      'GET /submissions/s1': () => json({ data: owned() }),
      'GET /users/kit/folders': () => json({ data: FOLDERS }),
      'PATCH /submissions/s1': () => json({ data: { ...owned(), title: 'New' } }),
    })
    const w = await mountSuspended(EditPage, { route: '/view/s1/edit' })
    await flushPromises()
    expect((w.get('input[name="title"]').element as HTMLInputElement).value).toBe('Old')
    expect((w.get('textarea[name="body"]').element as HTMLTextAreaElement).value).toBe('old body')
    expect((w.get('input[name="rating"][value="general"]').element as HTMLInputElement).checked).toBe(true)
    expect(w.get('input[name="rating"][value="adult"]').attributes('disabled')).toBeDefined()
    await w.get('input[name="title"]').setValue('New')
    await w.get('select[name="folder"]').setValue('scraps')
    await w.get('form[data-test="details-form"]').trigger('submit')
    await flushPromises()
    expect(bodyOf(f, 'PATCH /submissions/s1')).toEqual({ title: 'New', folder: 'scraps' })
    expect(navigateToMock).toHaveBeenCalledWith('/view/s1')
  })

  it('delete asks first, then deletes and goes to the gallery', async () => {
    const f = mockFetch({
      'GET /submissions/s1': () => json({ data: owned() }),
      'GET /users/kit/folders': () => json({ data: FOLDERS }),
      'DELETE /submissions/s1': () => json(null, 204),
    })
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    const w = await mountSuspended(EditPage, { route: '/view/s1/edit' })
    await flushPromises()
    await w.get('button[data-test="delete"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalled()
    expect(f.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(false)

    confirm.mockReturnValue(true)
    await w.get('button[data-test="delete"]').trigger('click')
    await flushPromises()
    expect(f.mock.calls.some(([u, i]) => String(u).endsWith('/submissions/s1') && i?.method === 'DELETE')).toBe(true)
    expect(navigateToMock).toHaveBeenCalledWith('/user/kit/gallery')
  })

  it('non-owners cannot edit', async () => {
    setMe({ username: 'someone' })
    mockFetch({ 'GET /submissions/s1': () => json({ data: owned() }) })
    const w = await mountSuspended(EditPage, { route: '/view/s1/edit?x=1' })
    await flushPromises()
    expect(w.text()).toContain('You can only edit your own submissions.')
    expect(w.find('form[data-test="details-form"]').exists()).toBe(false)
  })
})
