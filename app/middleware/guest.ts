export default defineNuxtRouteMiddleware(() => {
  const auth = useAuthStore()
  if (auth.me) return navigateTo('/')
})
