/**
 * Ask before leaving while `active()` is true: in-app navigation (window.confirm) and
 * tab close/reload (`beforeunload`).
 *
 * Registered as a router.beforeEach guard removed on unmount rather than onBeforeRouteLeave:
 * same effect for a page, and it also works where the component is not rendered by
 * <RouterView> (onBeforeRouteLeave silently does nothing there, e.g. under mountSuspended).
 */
export function useLeaveGuard(active: () => boolean, message: string) {
  const router = useRouter()
  let removeGuard: (() => void) | null = null

  function onBeforeUnload(e: BeforeUnloadEvent) {
    if (!active()) return
    e.preventDefault()
    e.returnValue = message
  }

  onMounted(() => {
    removeGuard = router.beforeEach((to, from) => {
      if (!active() || to.path === from.path) return true
      return window.confirm(message)
    })
    window.addEventListener('beforeunload', onBeforeUnload)
  })
  onBeforeUnmount(() => {
    removeGuard?.()
    window.removeEventListener('beforeunload', onBeforeUnload)
  })
}
