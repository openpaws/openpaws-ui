import type { Submission } from '~/types/api'
import { markdownText } from '~/utils/markdownText'

/** Open Graph / Twitter tags. Adult submissions never expose an image. */
export function useSubmissionMeta(s: MaybeRefOrGetter<Submission | null | undefined>) {
  const siteUrl = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
  const sub = computed(() => toValue(s))
  const image = computed(() => {
    const x = sub.value
    if (!x || x.rating === 'adult') return undefined
    const m = x.media
    return (m.preview ?? m.thumb_lg ?? m.cover ?? m.thumb_md)?.url
  })
  useSeoMeta({
    title: () => `${sub.value?.title ?? ''} — OpenPaws`,
    ogTitle: () => sub.value?.title,
    ogType: 'article',
    ogUrl: () => `${siteUrl}/view/${sub.value?.id ?? ''}`,
    ogDescription: () => markdownText(sub.value?.description_html ?? '', 200),
    description: () => markdownText(sub.value?.description_html ?? '', 200),
    ogImage: () => image.value,
    twitterCard: () => (image.value ? 'summary_large_image' : 'summary'),
    twitterTitle: () => sub.value?.title,
    twitterImage: () => image.value,
  })
}
