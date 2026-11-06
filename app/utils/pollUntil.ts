export interface PollOptions {
  interval: number
  timeout: number
  /** Stop early (e.g. the component unmounted). */
  cancelled?: () => boolean
}

/**
 * Call `fn` every `interval` ms (first call after one interval) until `done(value)` or
 * `timeout` ms have passed. Failed calls are retried on the next tick. Null on timeout/cancel.
 */
export async function pollUntil<T>(fn: () => Promise<T>, done: (v: T) => boolean, opts: PollOptions): Promise<T | null> {
  for (let elapsed = 0; elapsed < opts.timeout; elapsed += opts.interval) {
    await new Promise(r => setTimeout(r, opts.interval))
    if (opts.cancelled?.()) return null
    try {
      const v = await fn()
      if (done(v)) return v
    }
    catch {
      // transient: try again next tick
    }
  }
  return null
}
