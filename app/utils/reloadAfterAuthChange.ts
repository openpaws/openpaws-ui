/**
 * Ruling U9: after login/logout/registration, do a full app reload to `path` so no cached
 * list, SSR payload or store state from the previous viewer survives the identity change.
 * `force` bypasses reloadNuxtApp's loop guard, which would otherwise skip a second reload
 * to the same path within its TTL (e.g. log in and straight back out on `/`).
 */
export function reloadAfterAuthChange(path: string) {
  reloadNuxtApp({ path, force: true, persistState: false })
}
