// Universal: load `me` once per request (SSR forwards cookies via useApi). On the client the
// Pinia state is hydrated from the payload, so `loaded` is already true and nothing refetches.
export default defineNuxtPlugin({
  name: 'auth-init',
  dependsOn: ['pinia'],
  async setup() {
    const auth = useAuthStore()
    if (!auth.loaded) {
      try {
        await auth.fetchMe()
      }
      catch {
        auth.loaded = true // API unreachable: render as a guest rather than failing the page
      }
    }
  },
})
