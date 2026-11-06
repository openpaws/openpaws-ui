<script setup lang="ts">
const auth = useAuthStore()
const route = useRoute()

const searchBox = ref('')
const searchOpen = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)

// Prefill from the URL on /search so the header mirrors the current query.
watch(() => [route.path, route.query.q, route.query.tags, route.query.exclude_tags] as const, ([path, q, tags, ex]) => {
  if (path !== '/search') return
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const split = (v: unknown) => str(v).split(',').map(s => s.trim()).filter(Boolean)
  searchBox.value = formatSearch({ q: str(q), tags: split(tags), exclude_tags: split(ex) })
}, { immediate: true })

async function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) {
    await nextTick()
    searchInput.value?.focus()
  }
}

async function onSearch() {
  const p = parseSearch(searchBox.value)
  const query: Record<string, string> = {}
  if (p.q) query.q = p.q.slice(0, 200)
  if (p.tags.length) query.tags = p.tags.slice(0, 20).join(',')
  if (p.exclude_tags.length) query.exclude_tags = p.exclude_tags.slice(0, 20).join(',')
  searchOpen.value = false
  await navigateTo({ path: '/search', query })
}

// User menu (WAI-ARIA menu button pattern).
const menuOpen = ref(false)
const menuWrap = ref<HTMLElement | null>(null)
const menuButton = ref<HTMLButtonElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const items = () => Array.from(menuEl.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

async function openMenu(focus: 'first' | 'last' | 'none' = 'first') {
  menuOpen.value = true
  if (focus === 'none') return
  await nextTick()
  const list = items()
  ;(focus === 'last' ? list.at(-1) : list[0])?.focus()
}
function closeMenu(returnFocus = false) {
  menuOpen.value = false
  if (returnFocus) menuButton.value?.focus()
}
function onButtonKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    void openMenu('first')
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    void openMenu('last')
  }
  else if (e.key === 'Escape') closeMenu()
}
function onButtonClick() {
  if (menuOpen.value) closeMenu()
  else void openMenu('none')
}
function onMenuKey(e: KeyboardEvent) {
  const list = items()
  const i = list.indexOf(document.activeElement as HTMLElement)
  const go = (n: number) => {
    e.preventDefault()
    list[(n + list.length) % list.length]?.focus()
  }
  if (e.key === 'ArrowDown') go(i + 1)
  else if (e.key === 'ArrowUp') go(i - 1)
  else if (e.key === 'Home') go(0)
  else if (e.key === 'End') go(list.length - 1)
  else if (e.key === 'Escape') {
    e.preventDefault()
    closeMenu(true)
  }
  else if (e.key === 'Tab') closeMenu()
}
function onDocClick(e: Event) {
  if (menuOpen.value && !menuWrap.value?.contains(e.target as Node)) closeMenu()
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
watch(() => route.fullPath, () => closeMenu())

async function onLogout() {
  closeMenu()
  await auth.logout()
  await navigateTo('/')
}
</script>

<template>
  <header class="app-header">
    <div class="container app-header__inner">
      <NuxtLink to="/" class="app-header__logo">OpenPaws</NuxtLink>
      <form
        id="header-search"
        role="search"
        class="app-header__search"
        :class="{ 'is-open': searchOpen }"
        @submit.prevent="onSearch"
      >
        <input
          ref="searchInput"
          v-model="searchBox"
          type="search"
          aria-label="Search submissions"
          placeholder="Search, e.g. fox #wolf"
          maxlength="300"
          autocomplete="off"
          @keydown.esc="searchOpen = false"
        >
      </form>
      <nav class="app-header__nav" aria-label="Account">
        <button
          type="button"
          class="app-header__icon-btn app-header__search-toggle"
          aria-label="Search"
          aria-controls="header-search"
          :aria-expanded="searchOpen ? 'true' : 'false'"
          @click="toggleSearch"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
            <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M15 15l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
        <template v-if="auth.me">
          <NuxtLink to="/upload" class="app-header__upload">Upload</NuxtLink>
          <div ref="menuWrap" class="user-menu">
            <button
              ref="menuButton"
              type="button"
              class="app-header__menu-btn"
              aria-haspopup="menu"
              :aria-expanded="menuOpen ? 'true' : 'false'"
              @click="onButtonClick"
              @keydown="onButtonKey"
            >
              <img
                v-if="auth.me.avatar_url"
                :src="auth.me.avatar_url"
                alt=""
                class="app-header__avatar"
                width="24"
                height="24"
              >
              <span class="app-header__name">{{ auth.me.display_name }}</span>
            </button>
            <div v-if="menuOpen" ref="menuEl" class="user-menu__list" role="menu" aria-label="Account menu" @keydown="onMenuKey">
              <NuxtLink :to="`/user/${auth.me.username}`" role="menuitem" tabindex="-1">Profile</NuxtLink>
              <NuxtLink to="/settings" role="menuitem" tabindex="-1">Settings</NuxtLink>
              <button type="button" role="menuitem" tabindex="-1" @click="onLogout">Log out</button>
            </div>
          </div>
        </template>
        <template v-else>
          <NuxtLink to="/login">Log in</NuxtLink>
          <NuxtLink to="/register">Register</NuxtLink>
        </template>
        <ThemeToggle />
      </nav>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.app-header__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  padding-block: 0.5rem;
}
.app-header__logo {
  font-weight: 700;
  font-size: 1.25rem;
  color: var(--text);
  text-decoration: none;
}
.app-header__search {
  flex: 1 1 12rem;
  min-width: 0;
  max-width: 28rem;
}
.app-header__search input {
  width: 100%;
  min-height: 2.5rem;
  padding: 0 0.75rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
}
.app-header__nav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  margin-left: auto;
}
.app-header__upload {
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  padding: 0 1rem;
  border-radius: 999px;
  background: var(--accent);
  color: var(--bg);
  text-decoration: none;
}
.app-header__icon-btn,
.app-header__menu-btn {
  min-height: 2.5rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
.app-header__icon-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  padding: 0;
  border-radius: 999px;
}
.app-header__menu-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 11rem;
  border-radius: 999px;
  padding: 0 0.875rem 0 0.5rem;
}
.app-header__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-header__avatar {
  border-radius: 50%;
  object-fit: cover;
}
.user-menu {
  position: relative;
}
.user-menu__list {
  position: absolute;
  right: 0;
  top: calc(100% + 0.25rem);
  z-index: 50;
  min-width: 10rem;
  display: flex;
  flex-direction: column;
  padding: 0.25rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface);
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);
}
.user-menu__list > a,
.user-menu__list > button {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 0;
  border-radius: 0.3rem;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
.user-menu__list > a:hover,
.user-menu__list > button:hover,
.user-menu__list > a:focus-visible,
.user-menu__list > button:focus-visible {
  background: var(--border);
}

/* Narrow screens: the search box collapses behind an icon button. */
@media (max-width: 40rem) {
  .app-header__icon-btn {
    display: inline-flex;
  }
  .app-header__search {
    display: none;
    order: 3;
    flex: 1 1 100%;
    max-width: none;
  }
  .app-header__search.is-open {
    display: block;
  }
}
</style>
