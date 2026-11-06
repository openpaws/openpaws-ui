export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (!auth.me) return navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`)
})
