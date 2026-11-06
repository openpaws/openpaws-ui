import type { Submission } from '~/types/api'

export const sub = (over: Partial<Submission> = {}): Submission => ({
  id: 's1', type: 'image', title: 'Fox', description: 'd', description_html: '<p>Hello</p>', alt_text: null,
  rating: 'general', status: 'published', visibility: 'public', tags: ['fox'], views_count: 3,
  published_at: '2026-01-02T00:00:00Z', created_at: '2026-01-01T00:00:00Z',
  user: { username: 'kit', display_name: 'Kit', avatar_url: null, banner_url: null, created_at: null },
  folders: [],
  media: { preview: { url: 'https://cdn/p.jpg', mime: 'image/jpeg', size_bytes: 1 }, original: { url: 'https://cdn/o.png', mime: 'image/png', size_bytes: 2 } },
  ...over,
})
