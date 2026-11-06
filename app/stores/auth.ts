import { defineStore } from 'pinia'
import type { Me } from '~/types/api'
import { ApiError } from '~/utils/apiError'

export interface RegisterPayload {
  username: string
  display_name: string
  email: string
  password: string
  password_confirmation: string
}

function usesAuthMiddleware(meta: Record<string, unknown> | undefined): boolean {
  const mw = meta?.middleware
  return Array.isArray(mw) ? mw.includes('auth') : mw === 'auth'
}

export const useAuthStore = defineStore('auth', () => {
  const me = ref<Me | null>(null)
  const loaded = ref(false)

  async function fetchMe() {
    const api = useApi()
    try {
      const res = await api<{ data: Me }>('/me')
      me.value = res.data
    }
    catch (e) {
      if (e instanceof ApiError && e.status === 401) me.value = null
      else throw e
    }
    finally {
      loaded.value = true
    }
  }

  async function login(input: { login: string, password: string, remember?: boolean }) {
    const res = await useApi()<{ data?: Me } | undefined>('/auth/login', { method: 'POST', body: input })
    if (res?.data) {
      me.value = res.data
      loaded.value = true
    }
    else {
      await fetchMe()
    }
  }

  async function register(input: RegisterPayload) {
    const res = await useApi()<{ data: Me }>('/auth/register', { method: 'POST', body: input })
    me.value = res.data
    loaded.value = true
  }

  async function logout() {
    try {
      await useApi()('/auth/logout', { method: 'POST' })
    }
    finally {
      me.value = null
    }
  }

  /** Called on any 401: forget the user; bounce to login when on a protected route. */
  function onUnauthenticated() {
    me.value = null
    const route = useRoute()
    if (usesAuthMiddleware(route.meta as Record<string, unknown>)) {
      void navigateTo(`/login?next=${encodeURIComponent(route.fullPath)}`)
    }
  }

  return { me, loaded, fetchMe, login, register, logout, onUnauthenticated }
})
