import { describe, it, expect } from 'vitest'
import { parseSearch, formatSearch } from '~/utils/searchSyntax'

describe('searchSyntax', () => {
  it('parses "fox #wolf -#gore" into q, tags, exclude_tags', () => {
    expect(parseSearch('fox #wolf -#gore')).toEqual({ q: 'fox', tags: ['wolf'], exclude_tags: ['gore'] })
  })
  it('ignores empty # tokens and duplicates', () => {
    expect(parseSearch('# -# #a #A #a -#b -#b')).toEqual({ q: '', tags: ['a'], exclude_tags: ['b'] })
  })
  it('round-trips', () => {
    for (const x of ['fox #wolf -#gore', 'a b c', '#x #y', '-#z hello world', '']) {
      const p = parseSearch(x)
      expect(parseSearch(formatSearch(p))).toEqual(p)
    }
    expect(formatSearch({ q: 'fox', tags: ['wolf'], exclude_tags: ['gore'] })).toBe('fox #wolf -#gore')
  })
})
