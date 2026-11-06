export type ThemeMode = 'system' | 'light' | 'dark'

const MODES: ThemeMode[] = ['system', 'light', 'dark']

function isMode(v: unknown): v is ThemeMode {
  return typeof v === 'string' && (MODES as string[]).includes(v)
}

export function useTheme() {
  const cookie = useCookie<string | null>('op_theme', {
    default: () => 'system',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  })

  const theme = computed<ThemeMode>(() => (isMode(cookie.value) ? cookie.value : 'system'))

  function set(t: ThemeMode) {
    cookie.value = t
  }

  function cycle() {
    set(MODES[(MODES.indexOf(theme.value) + 1) % MODES.length]!)
  }

  useHead({
    htmlAttrs: { 'data-theme': computed(() => (theme.value === 'system' ? undefined : theme.value)) },
  })

  return { theme, set, cycle }
}
