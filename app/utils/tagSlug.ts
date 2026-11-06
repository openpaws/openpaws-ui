/** Same normalisation as the API's TagNormalizer::slug (without alias resolution). */
export function tagSlug(value: string): string {
  return value.trim().toLowerCase()
    .replace(/\s+/gu, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
    .replace(/^_+|_+$/g, '')
}
