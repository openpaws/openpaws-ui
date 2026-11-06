import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { injectHead } from '#imports'
import type { Submission } from '~/types/api'
import { resolveTags } from 'unhead/utils'
import { sub } from '../helpers/submission'
import { markdownText } from '~/utils/markdownText'

async function tags(s: Submission) {
  const C = defineComponent({ setup() { useSubmissionMeta(s); return () => h('div') } })
  const w = await mountSuspended(C)
  const resolved = resolveTags(injectHead())
  w.unmount()
  const get = (k: string) => resolved.find(t => t.tag === 'meta' && (t.props.property === k || t.props.name === k))?.props.content
  return { get, title: resolved.find(t => t.tag === 'title')?.textContent }
}

describe('useSubmissionMeta', () => {
  it('og:image present for general, with title and url', async () => {
    const t = await tags(sub())
    expect(t.get('og:image')).toBe('https://cdn/p.jpg')
    expect(t.get('twitter:image')).toBe('https://cdn/p.jpg')
    expect(t.get('twitter:card')).toBe('summary_large_image')
    expect(t.get('og:url')).toBe('http://localhost:3000/view/s1')
    expect(t.title).toBe('Fox — OpenPaws')
  })
  it('og:image and twitter:image omitted for adult; card is summary', async () => {
    const t = await tags(sub({ rating: 'adult' }))
    expect(t.get('og:image')).toBeUndefined()
    expect(t.get('twitter:image')).toBeUndefined()
    expect(t.get('twitter:card')).toBe('summary')
  })
  it('og:description is plain text ≤200 chars', async () => {
    const t = await tags(sub({ description_html: `<p>${'word '.repeat(100)}<strong>x</strong></p>` }))
    const d = t.get('og:description')!
    expect(d.length).toBeLessThanOrEqual(200)
    expect(d).not.toMatch(/[<>]/)
    expect(d.endsWith('…')).toBe(true)
  })
})

describe('markdownText', () => {
  it('strips tags, decodes entities, collapses whitespace', () => {
    expect(markdownText('<p>Fish &amp; chips &lt;3 &#39;hi&#39; &#x41;</p>\n<p>two\n  lines</p>')).toBe('Fish & chips <3 \'hi\' A two lines')
  })
  it('truncates on a word boundary with an ellipsis', () => {
    const out = markdownText('<p>alpha beta gamma delta</p>', 14)
    expect(out).toBe('alpha beta…')
    expect(markdownText('short', 200)).toBe('short')
  })
})
