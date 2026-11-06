# OpenPaws Phase 1 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the openpaws-ui Nuxt front end for Phase 1: auth and settings, browse/search/tags, a submission viewer for all four media types, profile galleries and folders, and the upload wizard.

**Architecture:** A server-rendered Nuxt 4 app that talks only to openpaws-api through one typed `useApi()` client, using cookie sessions with Sanctum's CSRF cookie. During SSR, the browser's cookies are forwarded to the API, so rendered pages respect the viewer's rating filter. The UI makes no visibility decisions: it renders what the API returns, and treats a 404 as "not found".

**Tech Stack:** Nuxt 4.6.x (Vue 3, TypeScript strict), Pinia, `@nuxt/test-utils` + Vitest + `@vue/test-utils`, Playwright (system Chromium on Alpine), ESLint (`@nuxt/eslint`). Plain CSS with custom properties for theming; no UI framework.

**Spec:** `../openpaws-api/docs/superpowers/specs/2026-11-06-openpaws-phase1-design.md` (read it alongside this plan).

**Depends on:** `../openpaws-api/docs/superpowers/plans/2026-11-06-openpaws-phase1-api.md`. The API's resource shapes, routes and error codes are defined there; this plan's types mirror them. Unit and component tests mock the API; Task 11's end-to-end tests need the real API running.

## Global Constraints

- Node 24, npm. Run as root; after every task run `chown -R devkat:devkat /var/www/devkat.uk/htdocs/openpaws-ui`.
- Runtime config: `NUXT_PUBLIC_API_BASE` (default `http://localhost:8000`) and `NUXT_PUBLIC_SITE_URL` (default `http://localhost:3000`). All API paths are `/api/v1/...`. The CSRF cookie comes from `/sanctum/csrf-cookie`.
- The API error shape `{error:{code,message,fields?}}` becomes a thrown `ApiError` with `status`, `code`, `message`, `fields`.
- Routes (exact): `/`, `/search`, `/tag/[slug]`, `/view/[id]`, `/user/[username]`, `/user/[username]/gallery`, `/user/[username]/scraps`, `/user/[username]/folder/[id]`, `/upload`, `/view/[id]/edit`, `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/settings`.
- Ratings: `general|mature|adult`, with badge labels `G`, `M`, `A`.
- The layout must work from 360 px wide; there's no horizontal page scroll at any width. Light and dark themes follow the system setting, with a toggle remembered in a cookie (`op_theme`) so SSR renders the right theme.
- Accessibility: every interactive control is keyboard-reachable with a visible focus ring; images carry alt text (title, or a user-entered description); text contrast ≥ 4.5:1 in both themes.
- Upload limits shown in the UI come from the API's 422 responses. The UI may pre-check against the same values: image 50 MB, audio 200 MB, video 2 GB, document 10 MB, cover/avatar/banner 10 MB.
- Open Graph: submission pages set `og:title`, `og:description` (first 200 chars of description text), `og:url`, `og:type`; `og:image` = `thumb_lg` or `cover`, **omitted for adult**. Profile pages set `og:image` to the avatar.

## Review Focus

1. **SSR with a logged-in viewer**: a confirmed adult user opening `/view/{adultId}` directly (full page load, not client navigation) must see the work, not a 404. This requires forwarding cookies during SSR. Test in Task 2, checked end to end in Task 11.
2. **Upload interrupted mid-way**: if one multipart part's PUT fails, that part is retried up to 3 times before the wizard shows "Upload failed — retry", and retry resumes with only the missing parts. Test in Task 9.
3. **Very long unbroken titles, tags and usernames**: a 150-char title with no spaces and a 50-char tag must wrap or truncate inside cards and the viewer, without causing horizontal scroll at 360 px. Test in Task 5 (component) and Task 11 (viewport check).
4. **Leaving the wizard during upload**: navigating away or closing the tab while bytes are uploading prompts for confirmation (`beforeunload` plus a route-leave guard). Test in Task 9.
5. **Expired session mid-use**: a 401 from any call clears the auth store and sends the user to `/login?next=<current path>`; after login they return there. Test in Task 3.

---

## File map

```
app/
  app.vue, error.vue
  assets/css/{tokens.css, base.css}
  layouts/default.vue
  components/
    AppHeader.vue, ThemeToggle.vue, Toasts.vue, RatingBadge.vue
    submission/{SubmissionCard.vue, SubmissionGrid.vue, ImageViewer.vue, WritingReader.vue,
                AudioPlayer.vue, VideoPlayer.vue, SubmissionMeta.vue}
    upload/{FileStep.vue, DetailsStep.vue, ProcessingStep.vue, TagInput.vue}
    user/{ProfileHeader.vue, FolderNav.vue, FolderManager.vue}
    form/{TextField.vue, FormErrors.vue}
  composables/{useApi.ts, useCursorList.ts, useToasts.ts, useUploader.ts, useSubmissionMeta.ts}
  stores/auth.ts
  middleware/{auth.ts, guest.ts}
  pages/... (route list above)
  types/api.ts
  utils/{apiError.ts, markdownText.ts}
tests/unit/...  tests/e2e/...
nuxt.config.ts, vitest.config.ts, playwright.config.ts
```

---

### Task 1: Scaffold, theming, layout

**Files:**
- Create: the Nuxt app (`npm create nuxt@latest` into a temp dir, then move it in, keeping `LICENSE`, `README.md` and `docs/`), `app/assets/css/tokens.css`, `app/assets/css/base.css`, `app/layouts/default.vue`, `app/components/{AppHeader,ThemeToggle}.vue`, `vitest.config.ts`
- Test: `tests/unit/ThemeToggle.test.ts`

**Interfaces:**
- Produces: CSS tokens on `:root` (`--bg, --surface, --text, --muted, --accent, --danger, --border, --focus`), redefined under `[data-theme="dark"]` and under `@media (prefers-color-scheme: dark)` for `:root:not([data-theme="light"])`. `useTheme(): { theme: Ref<'system'|'light'|'dark'>, set(t) }` backed by the `op_theme` cookie and applied to `<html data-theme>` through `useHead`.

- [ ] **Step 1:** Scaffold the app and install `pinia @pinia/nuxt @nuxt/eslint @nuxt/test-utils vitest @vue/test-utils happy-dom @playwright/test`. Set `typescript.strict: true` and `runtimeConfig.public.{apiBase, siteUrl}`.
- [ ] **Step 2: Write the failing test** `ThemeToggle cycles system → light → dark and writes op_theme cookie`.
- [ ] **Step 3: Run** `npx vitest run` — FAIL. **Step 4: Implement.** **Step 5: Run** — PASS.
- [ ] **Step 6:** `npm run build` succeeds.
- [ ] **Step 7: Commit** `feat: scaffold Nuxt app with theming and layout`.

---

### Task 2: API client and types

**Files:**
- Create: `app/types/api.ts`, `app/utils/apiError.ts`, `app/composables/useApi.ts`, `app/composables/useCursorList.ts`
- Test: `tests/unit/useApi.test.ts`, `tests/unit/useCursorList.test.ts`

**Interfaces:**
- Produces:
  - `types/api.ts` mirrors the API resources exactly: `Rating`, `SubmissionType`, `SubmissionStatus`, `Visibility`, `User` (`username, display_name, avatar_url, banner_url, created_at`), `Me` (User + `email, email_verified, adult_confirmed, max_rating, role`), `Profile` (`bio, bio_html, links, species, pronouns, pinned: Submission[]`), `MediaRef` (`url, mime, width?, height?, duration_ms?, size_bytes`), `Submission` (fields as in API Task 6, `media: Partial<Record<'thumb_sm'|'thumb_md'|'thumb_lg'|'preview'|'original'|'transcode'|'cover'|'waveform'|'document', MediaRef>>`), `Folder`, `Tag`, `UploadKind` (`'image'|'audio'|'video'|'document'|'cover'|'avatar'|'banner'`), `UploadSession`, `Paginated<T> = { data: T[]; meta: { next_cursor: string|null } }`.
  - `class ApiError extends Error { status: number; code: string; fields: Record<string,string[]> }`.
  - `useApi(): <T>(path: string, opts?: { method?, body?, query? }) => Promise<T>`. It always sends `credentials: 'include'` and `Accept: application/json`. Before a non-GET request, if there is no `XSRF-TOKEN` cookie, it calls `/sanctum/csrf-cookie` once, then sends `X-XSRF-TOKEN`. On the server it forwards the incoming `cookie` header (`useRequestHeaders(['cookie'])`) plus `Origin: siteUrl` and `Referer`. Errors become `ApiError`. A 401 triggers the auth store's `onUnauthenticated()` (Task 3).
  - `useCursorList<T>(path: string, query: Ref<Record<string,unknown>>): { items: Ref<T[]>, loading, done, error, loadMore(), reset() }`. It resets when `query` changes.

- [ ] **Step 1: Write the failing tests**
  - `fetches csrf cookie once before the first POST and sends X-XSRF-TOKEN`.
  - `forwards cookie header during SSR` (mock `useRequestHeaders`; assert the outgoing header) (Review Focus #1).
  - `maps error shape to ApiError with fields`.
  - `cursor list appends pages and stops when next_cursor is null; resets on query change`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: typed API client and cursor lists`.

---

### Task 3: Auth store, middleware, auth pages

**Files:**
- Create: `app/stores/auth.ts`, `app/middleware/{auth,guest}.ts`, `app/pages/{login,register,verify-email,forgot-password,reset-password}.vue`, `app/components/form/{TextField,FormErrors}.vue`, `app/composables/useToasts.ts`, `app/components/Toasts.vue`, plus an app plugin that loads `me` on startup
- Test: `tests/unit/authStore.test.ts`, `tests/unit/pages/login.test.ts`

**Interfaces:**
- Produces:
  - `useAuthStore()`: `me: Me|null`, `loaded: boolean`, `fetchMe()`, `login({login,password,remember})`, `register({...})`, `logout()`, `onUnauthenticated()` (clears `me`; if the current route uses the `auth` middleware, navigates to `/login?next=<fullPath>`).
  - Middleware `auth` (requires `me`, else redirects to `/login?next=`), `guest` (redirects logged-in users to `/`).
  - `useToasts(): { push(msg: string, kind?: 'info'|'error'), items }`.
  - `/login` redirects to `next` after success, but only if `next` starts with `/` and not `//`.
  - `/verify-email?token=` POSTs `/auth/email/verify` on mount and shows success or "link expired — resend".

- [ ] **Step 1: Write the failing tests**
  - `login success stores me and redirects to next`; `rejects open-redirect next=//evil.com` (goes to `/`).
  - `shows field errors from 422`.
  - `401 from any call clears me and redirects to /login?next=current` (Review Focus #5).
  - `register posts username, display_name, email, password, confirmation`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: auth store, middleware and auth pages`.

---

### Task 4: Settings page

**Files:**
- Create: `app/pages/settings.vue` (sections: Account, Password, Profile, Avatar & banner, Content filter)
- Test: `tests/unit/pages/settings.test.ts`

**Interfaces:**
- Consumes: `PATCH /me`, `PATCH /me/password`, `PATCH /me/profile`, `POST /me/adult-confirmation`, `PATCH /me/settings`, `PUT /me/avatar|banner` (with `useUploader`, Task 9; until Task 9 exists, the avatar/banner section is left out and Task 9 adds it).
- 18+ copy (exact): heading **"Mature and adult content"**; checkbox **"I confirm I am 18 years of age or older"**; button **"Confirm"**. This is shown only when `adult_confirmed` is false. If email isn't verified, show "Verify your email to change this setting." and disable the control. After confirming, a radio group General / Mature / Adult sets `max_rating`.

- [ ] **Step 1: Write the failing tests:** `hides rating radios until adult confirmed`, `disables confirmation when email unverified`, `saves max_rating`, `profile links capped at 10 in the form`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: settings page with content filter`.

---

### Task 5: Submission cards and grid

**Files:**
- Create: `app/components/RatingBadge.vue`, `app/components/submission/{SubmissionCard,SubmissionGrid}.vue`
- Test: `tests/unit/SubmissionCard.test.ts`

**Interfaces:**
- Produces:
  - `<SubmissionCard :submission="Submission" />`: uses `media.thumb_md` (with `srcset` from sm/md/lg) when present, otherwise a placeholder showing a type icon and the type label. It shows the title (2-line clamp, `overflow-wrap:anywhere`), the artist display name, and a `RatingBadge` for mature/adult. It links to `/view/{id}`.
  - `<SubmissionGrid :items :loading :done @more />`: a responsive CSS grid (min column 160 px), with an IntersectionObserver sentinel that emits `more`, and an empty state reading "Nothing here yet."

- [ ] **Step 1: Write the failing tests:** `renders placeholder for audio without cover`, `shows badge for mature/adult only`, `long unbroken title is clamped and does not overflow` (assert classes/styles; Review Focus #3), `emits more when sentinel intersects`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: submission cards and grid`.

---

### Task 6: Browse, search and tag pages

**Files:**
- Create: `app/pages/index.vue`, `app/pages/search.vue`, `app/pages/tag/[slug].vue`
- Test: `tests/unit/pages/search.test.ts`

**Interfaces:**
- Consumes: `GET /browse`, `GET /search`, `GET /tags/{slug}`, `GET /tags/autocomplete`, `useCursorList`, `SubmissionGrid`.
- The page filter state lives in the URL query (`type`, `sort`, `period`, `q`, `tags`, `exclude_tags`), so links and the back button keep it. Search syntax in the box: plain words → `q`, `#tag` → `tags`, `-#tag` → `exclude_tags`.

- [ ] **Step 1: Write the failing tests:** `parses "fox #wolf -#gore" into q, tags, exclude_tags`, `changing type updates URL and reloads list`, `tag page shows tag usage count`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: browse, search and tag pages`.

---

### Task 7: Submission view page and media viewers

**Files:**
- Create: `app/pages/view/[id].vue`, `app/components/submission/{ImageViewer,WritingReader,AudioPlayer,VideoPlayer,SubmissionMeta}.vue`, `app/composables/useSubmissionMeta.ts`, `app/utils/markdownText.ts`, `app/error.vue`
- Test: `tests/unit/useSubmissionMeta.test.ts`, `tests/unit/viewers.test.ts`

**Interfaces:**
- Produces:
  - `ImageViewer`: shows `preview`; click toggles fit-to-screen and full size; a "Download original" link uses `original`.
  - `WritingReader`: renders `body_html` with font-size controls (3 steps, remembered in localStorage inside try/catch) and a "Download document" link when there is one.
  - `AudioPlayer`: `<audio>` playing `transcode`, the cover image, and a waveform drawn on `<canvas>` from the `waveform` JSON (fetched from its URL), which can be clicked to seek.
  - `VideoPlayer`: `<video controls preload="metadata">` with `transcode` and `poster=cover`.
  - `SubmissionMeta`: title, artist link, rating badge, tags (each linking to `/tag/{slug}`), published date, views, and `description_html`. It shows "Edit" when `me.username === submission.user.username`.
  - `useSubmissionMeta(s: Submission)` sets the Open Graph/Twitter tags per the Global Constraints. `markdownText(html, 200)` strips tags for the description.
  - Status handling: `processing` shows "Processing…" and polls every 3 s for the owner. `failed` shows the failure message with a link to retry in the upload wizard (`/upload?retry={id}`). A 404 from the API renders `error.vue` "Not found".

- [ ] **Step 1: Write the failing tests:** `og:image omitted for adult, present for general`, `og:description is plain text ≤200 chars`, `each type renders its viewer`, `processing polls and swaps to viewer when published`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: submission view page with media viewers`.

---

### Task 8: Profile, gallery, scraps, folders

**Files:**
- Create: `app/pages/user/[username]/{index,gallery,scraps}.vue`, `app/pages/user/[username]/folder/[id].vue`, `app/components/user/{ProfileHeader,FolderNav,FolderManager}.vue`
- Test: `tests/unit/FolderManager.test.ts`

**Interfaces:**
- Consumes: `GET /users/{u}`, `/users/{u}/submissions?folder=`, `/users/{u}/folders`, and the folder CRUD and order endpoints.
- `index`: banner, avatar, display name, `@username`, species/pronouns, `bio_html`, links (`rel="nofollow ugc noopener"`, `target="_blank"`), pinned grid, then the latest 12 gallery items with a "View gallery" link.
- `FolderManager` (owner only, on the gallery page): create, rename and delete custom folders, plus drag-and-drop reorder of a folder's items with keyboard alternatives (move up/down buttons), saved via `PUT /folders/{id}/order`.

- [ ] **Step 1: Write the failing tests:** `gallery and scraps cannot be renamed or deleted in the UI`, `reorder sends full id list`, `move up/down buttons reorder for keyboard users`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: profile, gallery, scraps and folders`.

---

### Task 9: Uploader and upload wizard

**Files:**
- Create: `app/composables/useUploader.ts`, `app/pages/upload.vue`, `app/components/upload/{FileStep,DetailsStep,ProcessingStep,TagInput}.vue`, `app/pages/view/[id]/edit.vue`
- Modify: `app/pages/settings.vue` (avatar and banner via `useUploader`)
- Test: `tests/unit/useUploader.test.ts`, `tests/unit/upload.test.ts`

**Interfaces:**
- Produces:
  - `useUploader()`: `upload(file: File, kind: UploadKind): Promise<string /* session id */>`, plus `progress: Ref<number /* 0..1 */>`, `state: Ref<'idle'|'uploading'|'completing'|'done'|'error'>`, `abort()`, `resume()`. Single PUTs use `XMLHttpRequest` (for progress events), with the `Content-Type` set to the declared mime. Multipart uploads run parts with concurrency 3 and retry each part up to 3 times with backoff of 1 s/3 s/9 s. They record the ETags (from the `ETag` response header; MinIO and S3 need CORS `ExposeHeaders: ETag`), then call `/complete`. `resume()` only re-requests URLs for missing parts.
  - Wizard: step 1 picks the type and file (plus an optional cover for audio, video and writing; writing can skip the file and use the body editor). Upload starts immediately in the background. Step 2 is details: title, description, body (writing), rating (required, no default selected), tags (`TagInput` with autocomplete, chips, a 60 limit), folder select, visibility. Step 3 publishes (`POST /submissions`) and then shows `ProcessingStep`, which polls `GET /submissions/{id}` every 3 s until `published` (redirects to `/view/{id}`) or `failed`.
  - `/upload?retry={id}`: reuses step 1 for the file and calls `POST /submissions/{id}/retry`.
  - The leave guard (`onBeforeRouteLeave` + `beforeunload`) is active while `state` is `uploading` or `completing`.
  - `/view/[id]/edit`: edits title, description, body, rating, tags, folder and visibility via PATCH, and deletes with a confirm dialog.

- [ ] **Step 1: Write the failing tests**
  - `single PUT reports progress and completes`.
  - `multipart retries a failing part 3 times then errors; resume uploads only missing parts` (Review Focus #2).
  - `rating must be chosen before publish`.
  - `leaving during upload asks for confirmation` (Review Focus #4).
  - `processing step redirects on published and shows retry on failed`.
  - `client pre-check blocks a 51 MB image with the limit message`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5:** Add the bucket CORS rule to `../openpaws-api/docs/dev-setup.md` (`AllowedOrigins: [http://localhost:3000]`, `AllowedMethods: [PUT]`, `ExposeHeaders: [ETag]`) and apply it with `mc`.
- [ ] **Step 6: Commit** `feat: uploader and upload wizard`.

---

### Task 10: Header navigation, error page polish, accessibility pass

**Files:**
- Modify: `AppHeader.vue` (logo → `/`, search box → `/search`, Upload button, user menu: Profile / Settings / Log out; Log in / Register for guests), `error.vue` (404 "Not found", 500 "Something went wrong" with request id when given)
- Test: `tests/unit/AppHeader.test.ts`

- [ ] **Step 1: Write the failing tests:** `guest sees Log in and Register`, `user menu is keyboard operable (Enter/Escape/arrow keys)`, `error page shows request id`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: header navigation and error pages`.

---

### Task 11: End-to-end tests

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/{signup-upload,adult-gating,layout}.spec.ts`, `tests/e2e/helpers.ts`

**Interfaces:**
- Consumes: the running API (`php artisan serve`, `queue:work`), MinIO and Meilisearch from the API plan, plus `nuxt build && node .output/server/index.mjs`. The helpers verify email through an API-side test helper command: `php artisan openpaws:test-verify {username}`, which is **added to the API in this task**, registered only when `app()->environment('local','testing')`.
- Playwright uses system Chromium: `apk add chromium`, and `use.launchOptions.executablePath: '/usr/bin/chromium'`.

- [ ] **Step 1: Write the specs**
  - `signup-upload`: register → verify (helper) → settings confirm 18+ and set Adult → upload `image.png` (from the API fixtures) as General with tag `e2etest` → land on `/view/{id}` → it appears on `/` and in `/search?q=<title>`.
  - `adult-gating`: as the user above, upload an Adult image. Full-page load of `/view/{id}` shows it (Review Focus #1). In a new guest context, the same URL shows "Not found", and `/tag/e2etest` doesn't list it.
  - `layout`: at viewport 360×740, check `/`, `/view/{id}` (with a 150-char unbroken title) and `/user/{u}` for `document.documentElement.scrollWidth <= 360` (Review Focus #3).
- [ ] **Step 2: Run** `npx playwright test` — Expected: PASS.
- [ ] **Step 3: Commit** in both repos: UI `test: end-to-end flows`; API `chore: local test verify command`.
