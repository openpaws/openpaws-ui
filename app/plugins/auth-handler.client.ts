// Client only: setUnauthenticatedHandler is module-level state and must never be set during SSR.
export default defineNuxtPlugin({
  name: 'auth-handler',
  dependsOn: ['pinia'],
  setup() {
    const auth = useAuthStore()
    setUnauthenticatedHandler(() => auth.onUnauthenticated())
  },
})
