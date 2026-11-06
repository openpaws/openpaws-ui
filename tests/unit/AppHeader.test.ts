import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import AppHeader from '~/components/AppHeader.vue'
import DefaultLayout from '~/layouts/default.vue'
import ErrorPage from '~/error.vue'
import { useAuthStore } from '~/stores/auth'
import { json, ME, mockFetch } from '../helpers/mockFetch'

const { navigateToMock } = vi.hoisted(() => ({ navigateToMock: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateToMock)

const key = (w: { trigger: (e: string, o?: object) => Promise<unknown> }, k: string) => w.trigger('keydown', { key: k })

describe('AppHeader', () => {
  beforeEach(() => {
    navigateToMock.mockReset()
    useAuthStore().me = null
  })

  it('guest sees Log in and Register', async () => {
    const w = await mountSuspended(AppHeader)
    const links = w.findAll('a').map(a => [a.text(), a.attributes('href')])
    expect(links).toContainEqual(['Log in', '/login'])
    expect(links).toContainEqual(['Register', '/register'])
    expect(w.find('[aria-haspopup="menu"]').exists()).toBe(false)
  })

  it('search submits to /search with #tags parsed', async () => {
    const w = await mountSuspended(AppHeader)
    await w.get('input[type="search"]').setValue('#wolf fox -#gore')
    await w.get('form[role="search"]').trigger('submit')
    expect(navigateToMock).toHaveBeenCalledWith({ path: '/search', query: { q: 'fox', tags: 'wolf', exclude_tags: 'gore' } })
  })

  it('collapses the search box behind an icon button on narrow screens', async () => {
    const w = await mountSuspended(AppHeader)
    const toggle = w.get('.app-header__search-toggle')
    expect(toggle.attributes('aria-label')).toBe('Search')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(w.get('form[role="search"]').classes()).not.toContain('is-open')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(w.get('form[role="search"]').classes()).toContain('is-open')
  })

  it('user sees Upload and a menu button; menu has Profile, Settings, Log out', async () => {
    useAuthStore().me = { ...ME, avatar_url: 'http://x/a.png' } as never
    const w = await mountSuspended(AppHeader, { attachTo: document.body })
    expect(w.get('a[href="/upload"]').text()).toBe('Upload')
    const btn = w.get('[aria-haspopup="menu"]')
    expect(btn.text()).toContain('Kit')
    expect(btn.find('img').exists()).toBe(true)
    expect(btn.attributes('aria-expanded')).toBe('false')
    await btn.trigger('click')
    expect(btn.attributes('aria-expanded')).toBe('true')
    const items = w.findAll('[role="menuitem"]')
    expect(items.map(i => i.text())).toEqual(['Profile', 'Settings', 'Log out'])
    expect(items[0]!.attributes('href')).toBe('/user/kit')
    expect(items[1]!.attributes('href')).toBe('/settings')
    w.unmount()
  })

  it('user menu is keyboard operable (Enter/Escape/arrow keys/Tab)', async () => {
    useAuthStore().me = ME as never
    const w = await mountSuspended(AppHeader, { attachTo: document.body })
    const btn = w.get('[aria-haspopup="menu"]')
    const items = () => w.findAll('[role="menuitem"]').map(i => i.element as HTMLElement)

    ;(btn.element as HTMLElement).focus()
    await key(btn, 'Enter')
    await flushPromises()
    expect(btn.attributes('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(items()[0])

    await key(w.get('[role="menu"]'), 'ArrowDown')
    expect(document.activeElement).toBe(items()[1])
    await key(w.get('[role="menu"]'), 'End')
    expect(document.activeElement).toBe(items()[2])
    await key(w.get('[role="menu"]'), 'ArrowDown')
    expect(document.activeElement).toBe(items()[0])
    await key(w.get('[role="menu"]'), 'ArrowUp')
    expect(document.activeElement).toBe(items()[2])
    await key(w.get('[role="menu"]'), 'Home')
    expect(document.activeElement).toBe(items()[0])

    await key(w.get('[role="menu"]'), 'Escape')
    await flushPromises()
    expect(btn.attributes('aria-expanded')).toBe('false')
    expect(w.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(btn.element)

    await key(btn, 'ArrowDown')
    await flushPromises()
    expect(document.activeElement).toBe(items()[0])
    await key(w.get('[role="menu"]'), 'Tab')
    expect(btn.attributes('aria-expanded')).toBe('false')

    await btn.trigger('click')
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(btn.attributes('aria-expanded')).toBe('false')
    w.unmount()
  })

  it('Log out navigates home even when the API fails', async () => {
    mockFetch({ 'POST /auth/logout': () => json({ error: { code: 'server_error', message: 'boom' } }, 500) })
    const auth = useAuthStore()
    auth.me = ME as never
    const w = await mountSuspended(AppHeader, { attachTo: document.body })
    await w.get('[aria-haspopup="menu"]').trigger('click')
    await w.findAll('[role="menuitem"]')[2]!.trigger('click')
    await flushPromises()
    expect(auth.me).toBeNull()
    expect(navigateToMock).toHaveBeenCalledWith('/')
    w.unmount()
  })
})

describe('layout', () => {
  it('skip link is the first focusable element and targets #main', async () => {
    const w = await mountSuspended(DefaultLayout)
    const first = w.find('a, button, input')
    expect(first.attributes('href')).toBe('#main')
    expect(first.text()).toBe('Skip to content')
    expect(w.find('main#main').exists()).toBe(true)
  })
})

describe('error page', () => {
  it('shows request id when present', async () => {
    const w = await mountSuspended(ErrorPage, { props: { error: { statusCode: 500, data: { requestId: 'req-123' } } as never } })
    expect(w.text()).toContain('Something went wrong')
    expect(w.text()).toContain('Reference: req-123')
  })
  it('omits reference without id; 404 copy', async () => {
    const w = await mountSuspended(ErrorPage, { props: { error: { statusCode: 404 } as never } })
    expect(w.text()).toContain('Not found')
    expect(w.text()).not.toContain('Reference')
  })
})
