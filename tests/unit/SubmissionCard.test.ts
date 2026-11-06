import { describe, it, expect, afterEach, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import SubmissionCard from '~/components/submission/SubmissionCard.vue'
import SubmissionGrid from '~/components/submission/SubmissionGrid.vue'
import type { Submission } from '~/types/api'

function make(over: Partial<Submission> = {}): Submission {
  return {
    id: 'abc123', type: 'image', title: 'A title', description: null, description_html: '', alt_text: null,
    rating: 'general', status: 'published', visibility: 'public', tags: [], views_count: 0,
    published_at: null, created_at: null,
    user: { username: 'fox', display_name: 'Fox Artist', avatar_url: null, banner_url: null, created_at: null },
    folders: [],
    media: {
      thumb_sm: { url: 'https://m/sm.jpg', mime: 'image/jpeg', size_bytes: 1, width: 200, height: 150 },
      thumb_md: { url: 'https://m/md.jpg', mime: 'image/jpeg', size_bytes: 1, width: 400, height: 300 },
      thumb_lg: { url: 'https://m/lg.jpg', mime: 'image/jpeg', size_bytes: 1, width: 800, height: 600 },
    },
    ...over,
  }
}

describe('SubmissionCard', () => {
  it('renders an image with srcset, lazy loading, alt and dimensions, linking to /view/id', async () => {
    const w = await mountSuspended(SubmissionCard, { props: { submission: make() } })
    const img = w.get('img')
    expect(img.attributes('src')).toBe('https://m/md.jpg')
    expect(img.attributes('srcset')).toBe('https://m/sm.jpg 200w, https://m/md.jpg 400w, https://m/lg.jpg 800w')
    expect(img.attributes('sizes')).toBeTruthy()
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('decoding')).toBe('async')
    expect(img.attributes('alt')).toBe('A title')
    expect(img.attributes('width')).toBe('400')
    expect(img.attributes('height')).toBe('300')
    expect(w.get('a').attributes('href')).toBe('/view/abc123')
    expect(w.findAll('a, button')).toHaveLength(1)
    expect(w.text()).toContain('Fox Artist')
  })

  it('uses alt_text as the image alt when set, else the title (U11)', async () => {
    const w = await mountSuspended(SubmissionCard, { props: { submission: make({ alt_text: 'A fox asleep in snow.' }) } })
    expect(w.get('img').attributes('alt')).toBe('A fox asleep in snow.')
    const t = await mountSuspended(SubmissionCard, { props: { submission: make({ alt_text: null }) } })
    expect(t.get('img').attributes('alt')).toBe('A title')
  })

  it('srcset only lists present sizes', async () => {
    const s = make()
    delete s.media.thumb_sm
    delete s.media.thumb_lg
    const w = await mountSuspended(SubmissionCard, { props: { submission: s } })
    expect(w.get('img').attributes('srcset')).toBe('https://m/md.jpg 400w')
  })

  it('renders placeholder for audio without cover', async () => {
    const w = await mountSuspended(SubmissionCard, { props: { submission: make({ type: 'audio', media: {} }) } })
    expect(w.find('img').exists()).toBe(false)
    const ph = w.get('[data-testid="placeholder"]')
    expect(ph.text()).toContain('Audio')
  })

  it('renders placeholder when media is {} for an image', async () => {
    const w = await mountSuspended(SubmissionCard, { props: { submission: make({ media: {} }) } })
    expect(w.find('img').exists()).toBe(false)
    expect(w.get('[data-testid="placeholder"]').text()).toContain('Image')
  })

  it('shows badge for mature/adult only', async () => {
    const g = await mountSuspended(SubmissionCard, { props: { submission: make() } })
    expect(g.find('[data-testid="rating-badge"]').exists()).toBe(false)
    const m = await mountSuspended(SubmissionCard, { props: { submission: make({ rating: 'mature' }) } })
    expect(m.get('[data-testid="rating-badge"]').text()).toBe('M')
    expect(m.get('[data-testid="rating-badge"]').attributes('aria-label')).toBe('Mature')
    const a = await mountSuspended(SubmissionCard, { props: { submission: make({ rating: 'adult' }) } })
    expect(a.get('[data-testid="rating-badge"]').text()).toBe('A')
    expect(a.get('[data-testid="rating-badge"]').attributes('aria-label')).toBe('Adult')
  })

  it('long unbroken title is clamped and does not overflow', async () => {
    const w = await mountSuspended(SubmissionCard, { props: { submission: make({ title: 'x'.repeat(300) }) } })
    const t = w.get('.card-title')
    expect(t.classes()).toContain('card-title')
    expect(t.text()).toBe('x'.repeat(300))
    // styling contract lives in the component's scoped CSS
    const src = (await import('~/components/submission/SubmissionCard.vue?raw')).default as string
    const block = (sel: string) => new RegExp(`${sel.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(src)?.[1] ?? ''
    const title = block('.card-title')
    expect(title).toMatch(/overflow-wrap:\s*anywhere/)
    expect(title).toMatch(/-webkit-line-clamp:\s*2/)
    expect(block('.card')).toMatch(/min-width:\s*0/)
    expect(block('.card-body')).toMatch(/min-width:\s*0/)
    const grid = (await import('~/components/submission/SubmissionGrid.vue?raw')).default as string
    expect(/\.grid > li\s*\{([^}]*)\}/.exec(grid)?.[1]).toMatch(/min-width:\s*0/)
  })
})

describe('SubmissionGrid', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('emits more when sentinel intersects', async () => {
    let cb: (e: Partial<IntersectionObserverEntry>[]) => void = () => {}
    class IO {
      constructor(c: typeof cb) { cb = c }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('IntersectionObserver', IO)
    const w = await mountSuspended(SubmissionGrid, { props: { items: [make()], loading: false, done: false } })
    cb([{ isIntersecting: false }])
    expect(w.emitted('more')).toBeUndefined()
    cb([{ isIntersecting: true }])
    expect(w.emitted('more')).toHaveLength(1)
    expect(w.find('button').exists()).toBe(false)
  })

  it('re-arms the observer so more fires once loading ends while sentinel stays visible', async () => {
    const instances: { disconnect: ReturnType<typeof vi.fn> }[] = []
    class IO {
      disconnect = vi.fn()
      constructor(private c: (e: Partial<IntersectionObserverEntry>[]) => void) { instances.push(this) }
      observe() { this.c([{ isIntersecting: true }]) }
      unobserve() {}
    }
    vi.stubGlobal('IntersectionObserver', IO)
    const w = await mountSuspended(SubmissionGrid, { props: { items: [make()], loading: true, done: false } })
    await nextTick()
    expect(w.emitted('more')).toBeUndefined()
    await w.setProps({ loading: false })
    await nextTick()
    expect(w.emitted('more')).toHaveLength(1)
    await w.setProps({ items: [make(), make({ id: 'z' })] })
    await nextTick()
    expect(w.emitted('more')).toHaveLength(2)
    w.unmount()
    expect(instances.at(-1)!.disconnect).toHaveBeenCalled()
  })

  it('shows empty state only when not loading and empty', async () => {
    const e = await mountSuspended(SubmissionGrid, { props: { items: [], loading: false, done: true } })
    expect(e.text()).toContain('Nothing here yet.')
    const l = await mountSuspended(SubmissionGrid, { props: { items: [], loading: true, done: false } })
    expect(l.text()).not.toContain('Nothing here yet.')
    expect(l.find('[role="status"]').exists()).toBe(true)
  })

  it('shows nothing more when done', async () => {
    const w = await mountSuspended(SubmissionGrid, { props: { items: [make()], loading: false, done: true } })
    expect(w.find('[data-testid="sentinel"]').exists()).toBe(false)
    expect(w.find('button').exists()).toBe(false)
  })

  it('falls back to a Load more button without IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const w = await mountSuspended(SubmissionGrid, { props: { items: [make()], loading: false, done: false } })
    await nextTick()
    const b = w.get('button')
    expect(b.text()).toBe('Load more')
    await b.trigger('click')
    expect(w.emitted('more')).toHaveLength(1)
  })
})
