import type { Folder, Single, UserProfileResponse } from '~/types/api'
import { ApiError } from '~/utils/apiError'

// useAsyncData wraps thrown errors in a NuxtError whose `cause` is the original.
const rootCause = (e: unknown): unknown =>
  e instanceof ApiError ? e : (e && typeof e === 'object' && 'cause' in e ? rootCause((e as { cause: unknown }).cause) : e)
const isNotFound = (e: unknown): boolean => {
  const c = rootCause(e)
  return c instanceof ApiError && c.status === 404
}

/** Profile + folders for the `[username]` route param, following param changes. */
export function useUserProfile() {
  const api = useApi()
  const route = useRoute()
  const username = computed(() => String(route.params.username))

  const profile = useAsyncData(
    () => `profile:${username.value}`,
    () => api<UserProfileResponse>(`/users/${encodeURIComponent(username.value)}`),
  )
  const folders = useAsyncData(
    () => `folders:${username.value}`,
    () => api<Single<Folder[]>>(`/users/${encodeURIComponent(username.value)}/folders`),
  )

  const notFound = computed(() => isNotFound(profile.error.value))
  watch(notFound, (v) => {
    if (v) showError(createError({ statusCode: 404, statusMessage: 'Not found', data: { requestId: (rootCause(profile.error.value) as ApiError).requestId } }))
  }, { immediate: true })

  // Only expose data for the current param (the previous user's lingers while the next loads).
  const same = <T extends { user: { username: string } }>(d: T | null | undefined) =>
    d && d.user.username.toLowerCase() === username.value.toLowerCase() ? d : null
  const data = computed(() => same(profile.data.value))
  const me = computed(() => useAuthStore().me)
  const isOwner = computed(() => !!data.value && me.value?.username === data.value.user.username)

  function useMeta() {
    const siteUrl = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
    const name = computed(() => data.value?.user.display_name || data.value?.user.username || username.value)
    useSeoMeta({
      title: () => `${name.value} (@${username.value}) — OpenPaws`,
      ogTitle: () => `${name.value} (@${username.value}) — OpenPaws`,
      ogType: 'profile',
      ogUrl: () => `${siteUrl}/user/${username.value}`,
      ogImage: () => data.value?.user.avatar_url ?? undefined,
      twitterCard: () => (data.value?.user.avatar_url ? 'summary_large_image' : 'summary'),
      twitterImage: () => data.value?.user.avatar_url ?? undefined,
    })
  }

  return {
    username, user: computed(() => data.value?.user ?? null), profile: computed(() => data.value?.profile ?? null),
    folders: computed(() => folders.data.value?.data ?? []), refreshFolders: () => folders.refresh(),
    notFound, isOwner, useMeta, ready: Promise.all([profile, folders]),
  }
}
