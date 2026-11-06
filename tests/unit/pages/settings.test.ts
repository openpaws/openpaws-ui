import { describe, it, expect, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { useAuthStore } from '~/stores/auth'
import { useToasts } from '~/composables/useToasts'
import Settings from '~/pages/settings.vue'
import { bodyOf, json, ME, mockFetch } from '../../helpers/mockFetch'

const PROFILE = { user: {}, profile: { bio: 'hi', bio_html: '<p>hi</p>', links: [{ label: 'Site', url: 'https://a.example' }], species: 'fox', pronouns: null, pinned: [] } }
const base = () => ({ 'GET /users/kit': () => json(PROFILE) })

async function mountPage(me: Record<string, unknown>, routes: Parameters<typeof mockFetch>[0] = {}) {
  useAuthStore().me = me as never
  const f = mockFetch({ ...base(), ...routes })
  const w = await mountSuspended(Settings, { route: '/settings' })
  await flushPromises()
  return { w, f }
}

describe('settings page', () => {
  beforeEach(() => { useToasts().items.value = [] })

  it('hides rating radios until adult confirmed', async () => {
    const { w } = await mountPage({ ...ME, adult_confirmed: false })
    expect(w.text()).toContain('Mature and adult content')
    expect(w.text()).toContain('I confirm I am 18 years of age or older')
    expect(w.find('input[type="radio"]').exists()).toBe(false)
  })

  it('disables confirmation when email unverified', async () => {
    const { w } = await mountPage({ ...ME, email_verified: false, adult_confirmed: false })
    expect(w.text()).toContain('Verify your email to change this setting.')
    expect(w.get('input[name="adult_confirm"]').attributes('disabled')).toBeDefined()
    expect(w.get('button[data-test="confirm-adult"]').attributes('disabled')).toBeDefined()
  })

  it('18+ confirm updates me and reveals the radios', async () => {
    const f = mockFetch({
      ...base(),
      'POST /me/adult-confirmation': () => json({ data: { ...ME, adult_confirmed: true } }),
    })
    useAuthStore().me = { ...ME, adult_confirmed: false } as never
    const w = await mountSuspended(Settings, { route: '/settings' })
    await flushPromises()
    await w.get('input[name="adult_confirm"]').setValue(true)
    await w.get('button[data-test="confirm-adult"]').trigger('click')
    await flushPromises()
    expect(bodyOf(f, 'POST /me/adult-confirmation')).toEqual({ confirm: true })
    expect(useAuthStore().me?.adult_confirmed).toBe(true)
    expect(w.findAll('input[type="radio"]')).toHaveLength(3)
    expect(w.find('fieldset legend').exists()).toBe(true)
  })

  it('saves max_rating', async () => {
    const { w, f } = await mountPage({ ...ME, adult_confirmed: true, max_rating: 'general' }, {
      'PATCH /me/settings': (_u, init) => json({ data: { ...ME, adult_confirmed: true, max_rating: JSON.parse(String(init.body)).max_rating } }),
    })
    await w.get('input[type="radio"][value="mature"]').setValue(true)
    await w.get('form[data-test="rating-form"]').trigger('submit')
    await flushPromises()
    expect(bodyOf(f, 'PATCH /me/settings')).toEqual({ max_rating: 'mature' })
    expect(useAuthStore().me?.max_rating).toBe('mature')
  })

  it('email change shows verification notice and marks unverified', async () => {
    const { w, f } = await mountPage({ ...ME }, {
      'PATCH /me': () => json({ data: { ...ME, email: 'new@example.com', email_verified: false } }),
    })
    await w.get('input[autocomplete="email"]').setValue('new@example.com')
    await w.get('form[data-test="account-form"]').trigger('submit')
    await flushPromises()
    expect(bodyOf(f, 'PATCH /me').email).toBe('new@example.com')
    expect(useAuthStore().me?.email_verified).toBe(false)
    expect(useToasts().items.value.map(t => t.msg)).toContain('Check your inbox to verify your new address.')
  })

  it('shows inline password errors', async () => {
    const { w } = await mountPage({ ...ME }, {
      'PATCH /me/password': () => json({ error: { code: 'validation_failed', message: 'x', fields: { current_password: ['Wrong password.'] } } }, 422),
    })
    await w.get('input[autocomplete="current-password"]').setValue('a')
    const n = w.findAll('input[autocomplete="new-password"]')
    await n[0]!.setValue('newpassword1')
    await n[1]!.setValue('newpassword1')
    await w.get('form[data-test="password-form"]').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Wrong password.')
  })

  it('profile links capped at 10 in the form', async () => {
    const { w } = await mountPage({ ...ME })
    for (let i = 0; i < 15; i++) {
      const add = w.find('button[data-test="add-link"]')
      if (add.exists() && !add.attributes('disabled')) await add.trigger('click')
    }
    expect(w.findAll('input[name="link_label"]')).toHaveLength(10)
    expect(w.get('button[data-test="add-link"]').attributes('disabled')).toBeDefined()
  })

  it('saves the profile', async () => {
    const { w, f } = await mountPage({ ...ME }, { 'PATCH /me/profile': () => json({ data: {} }) })
    expect((w.get('textarea[name="bio"]').element as HTMLTextAreaElement).value).toBe('hi')
    await w.get('input[name="species"]').setValue('wolf')
    await w.get('form[data-test="profile-form"]').trigger('submit')
    await flushPromises()
    expect(bodyOf(f, 'PATCH /me/profile')).toMatchObject({ bio: 'hi', species: 'wolf', links: [{ label: 'Site', url: 'https://a.example' }] })
  })
})
