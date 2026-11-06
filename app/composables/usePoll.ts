/**
 * Client-only interval while `active()` is true; stops when it turns false or the component unmounts.
 * A tick never overlaps a still-running previous one.
 */
export function usePoll(active: () => boolean, fn: () => Promise<unknown> | unknown, ms = 3000) {
  let timer: ReturnType<typeof setInterval> | null = null
  let running = false
  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }
  async function tick() {
    if (running) return
    running = true
    try {
      await fn()
    }
    catch {
      // transient failure: try again on the next tick
    }
    finally {
      running = false
    }
  }
  onMounted(() => {
    watch(active, (on) => {
      if (on && !timer) timer = setInterval(tick, ms)
      else if (!on) stop()
    }, { immediate: true })
  })
  onBeforeUnmount(stop)
  return { stop }
}
