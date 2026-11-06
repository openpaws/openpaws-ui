export interface ParsedSearch { q: string, tags: string[], exclude_tags: string[] }

/** "fox #wolf -#gore" -> { q: 'fox', tags: ['wolf'], exclude_tags: ['gore'] }. Empty `#` and duplicates are dropped. */
export function parseSearch(input: string): ParsedSearch {
  const words: string[] = []
  const tags: string[] = []
  const exclude_tags: string[] = []
  const add = (list: string[], raw: string) => {
    const t = raw.toLowerCase()
    if (t && !list.includes(t)) list.push(t)
  }
  for (const tok of input.split(/\s+/)) {
    if (!tok) continue
    if (tok.startsWith('-#')) add(exclude_tags, tok.slice(2))
    else if (tok.startsWith('#')) add(tags, tok.slice(1))
    else words.push(tok)
  }
  return { q: words.join(' '), tags, exclude_tags }
}

/** Inverse of parseSearch, used to prefill the box from URL query values. */
export function formatSearch(s: Partial<ParsedSearch>): string {
  return [
    s.q?.trim() || '',
    ...(s.tags ?? []).map(t => `#${t}`),
    ...(s.exclude_tags ?? []).map(t => `-#${t}`),
  ].filter(Boolean).join(' ')
}
