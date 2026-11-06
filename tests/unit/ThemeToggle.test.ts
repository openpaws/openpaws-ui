import { describe, it, expect, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ThemeToggle from '~/components/ThemeToggle.vue'

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.cookie = 'op_theme=; Max-Age=0; path=/'
  })

  it('cycles system → light → dark and writes op_theme cookie', async () => {
    const wrapper = await mountSuspended(ThemeToggle)
    const button = wrapper.get('button')
    const cookie = () => /(?:^|;\s*)op_theme=([^;]*)/.exec(document.cookie)?.[1]

    expect(button.attributes('data-theme-mode')).toBe('system')

    await button.trigger('click')
    expect(button.attributes('data-theme-mode')).toBe('light')
    expect(cookie()).toBe('light')

    await button.trigger('click')
    expect(button.attributes('data-theme-mode')).toBe('dark')
    expect(cookie()).toBe('dark')

    await button.trigger('click')
    expect(button.attributes('data-theme-mode')).toBe('system')
    expect(cookie()).toBe('system')
  })
})
