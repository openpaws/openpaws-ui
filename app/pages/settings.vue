<script setup lang="ts">
import type { Me, Rating, UserProfileResponse } from '~/types/api'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Settings — OpenPaws' })

const auth = useAuthStore()
const api = useApi()
const toasts = useToasts()
const MAX_LINKS = 10

const account = useFormError()
const pw = useFormError()
const prof = useFormError()
const adult = useFormError()
const rating = useFormError()

const accountForm = reactive({ display_name: auth.me?.display_name ?? '', email: auth.me?.email ?? '' })
const pwForm = reactive({ current_password: '', password: '', password_confirmation: '' })
const profileForm = reactive({
  bio: '',
  species: '',
  pronouns: '',
  links: [] as { label: string, url: string }[],
})
const adultChecked = ref(false)
const maxRating = ref<Rating>(auth.me?.max_rating ?? 'general')

const verified = computed(() => auth.me?.email_verified ?? false)
const confirmed = computed(() => auth.me?.adult_confirmed ?? false)

const profileLoaded = ref(false)
const profileLoadError = ref('')

async function loadProfile() {
  if (!auth.me) return
  profileLoadError.value = ''
  try {
    const res = await api<UserProfileResponse>(`/users/${encodeURIComponent(auth.me.username)}`)
    profileForm.bio = res.profile.bio ?? ''
    profileForm.species = res.profile.species ?? ''
    profileForm.pronouns = res.profile.pronouns ?? ''
    profileForm.links = (res.profile.links ?? []).map(l => ({ label: String(l.label ?? ''), url: String(l.url ?? '') }))
    profileLoaded.value = true
  }
  catch {
    profileLoadError.value = 'Could not load your current profile.'
  }
}
await loadProfile()

function saveAccount() {
  return account.run(async () => {
    const body: Record<string, string> = {}
    if (accountForm.display_name !== (auth.me?.display_name ?? '')) body.display_name = accountForm.display_name
    if (accountForm.email !== auth.me?.email) body.email = accountForm.email
    if (!Object.keys(body).length) return
    const res = await api<{ data: Me }>('/me', { method: 'PATCH', body })
    auth.me = res.data
    toasts.push(body.email && !res.data.email_verified ? 'Check your inbox to verify your new address.' : 'Account updated.')
  })
}

function savePassword() {
  return pw.run(async () => {
    await api('/me/password', { method: 'PATCH', body: { ...pwForm } })
    pwForm.current_password = pwForm.password = pwForm.password_confirmation = ''
    toasts.push('Password changed.')
  })
}

function addLink() {
  if (profileForm.links.length < MAX_LINKS) profileForm.links.push({ label: '', url: '' })
}

function saveProfile() {
  if (!profileLoaded.value) return
  return prof.run(async () => {
    await api('/me/profile', {
      method: 'PATCH',
      body: {
        bio: profileForm.bio || null,
        species: profileForm.species || null,
        pronouns: profileForm.pronouns || null,
        links: profileForm.links,
      },
    })
    toasts.push('Profile saved.')
  })
}

function confirmAdult() {
  return adult.run(async () => {
    const res = await api<{ data: Me }>('/me/adult-confirmation', { method: 'POST', body: { confirm: true } })
    auth.me = res.data
    maxRating.value = res.data.max_rating
    toasts.push('Age confirmed.')
  })
}

function saveRating() {
  return rating.run(async () => {
    const res = await api<{ data: Me }>('/me/settings', { method: 'PATCH', body: { max_rating: maxRating.value } })
    auth.me = res.data
    toasts.push('Content filter saved.')
  }).then(() => {
    if (rating.fields.value.max_rating && auth.me) maxRating.value = auth.me.max_rating
  })
}

const ratings: { value: Rating, label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'mature', label: 'Mature' },
  { value: 'adult', label: 'Adult' },
]
</script>

<template>
  <section class="settings">
    <h1>Settings</h1>

    <form data-test="account-form" novalidate @submit.prevent="saveAccount">
      <h2>Account</h2>
      <FormErrors :message="account.message.value" />
      <FormTextField v-model="accountForm.display_name" name="display_name" label="Display name" autocomplete="nickname" :error="account.fieldError('display_name')" />
      <FormTextField v-model="accountForm.email" name="email" type="email" label="Email" autocomplete="email" :error="account.fieldError('email')" />
      <p v-if="auth.me && !verified" class="hint">
        Your email address is not verified.
      </p>
      <button type="submit" :disabled="account.pending.value">
        {{ account.pending.value ? 'Saving…' : 'Save account' }}
      </button>
    </form>

    <form data-test="password-form" novalidate @submit.prevent="savePassword">
      <h2>Password</h2>
      <FormErrors :message="pw.message.value" />
      <FormTextField v-model="pwForm.current_password" name="current_password" type="password" label="Current password" autocomplete="current-password" required :error="pw.fieldError('current_password')" />
      <FormTextField v-model="pwForm.password" name="password" type="password" label="New password" autocomplete="new-password" required :error="pw.fieldError('password')" />
      <FormTextField v-model="pwForm.password_confirmation" name="password_confirmation" type="password" label="Confirm new password" autocomplete="new-password" required :error="pw.fieldError('password_confirmation')" />
      <button type="submit" :disabled="pw.pending.value">
        {{ pw.pending.value ? 'Saving…' : 'Change password' }}
      </button>
    </form>

    <form data-test="profile-form" novalidate @submit.prevent="saveProfile">
      <h2>Profile</h2>
      <div v-if="profileLoadError" class="load-error" role="alert">
        <p>{{ profileLoadError }}</p>
        <button type="button" data-test="retry-profile" @click="loadProfile">
          Retry
        </button>
      </div>
      <FormErrors :message="prof.message.value" />
      <fieldset class="bare" :disabled="!profileLoaded">
      <div class="field">
        <label for="bio">Bio</label>
        <textarea id="bio" v-model="profileForm.bio" name="bio" rows="6" maxlength="20000" />
        <p v-if="prof.fieldError('bio')" class="field__error">
          {{ prof.fieldError('bio') }}
        </p>
      </div>
      <FormTextField v-model="profileForm.species" name="species" label="Species" :error="prof.fieldError('species')" />
      <FormTextField v-model="profileForm.pronouns" name="pronouns" label="Pronouns" :error="prof.fieldError('pronouns')" />
      <fieldset>
        <legend>Links</legend>
        <div v-for="(link, i) in profileForm.links" :key="i" class="link-row">
          <FormTextField v-model="link.label" name="link_label" label="Label" :error="prof.fieldError(`links.${i}.label`)" />
          <FormTextField v-model="link.url" name="link_url" type="url" label="URL" :error="prof.fieldError(`links.${i}.url`)" />
          <button type="button" :aria-label="`Remove link ${i + 1}`" @click="profileForm.links.splice(i, 1)">
            Remove
          </button>
        </div>
        <button type="button" data-test="add-link" :disabled="profileForm.links.length >= MAX_LINKS" @click="addLink">
          Add link
        </button>
        <p v-if="profileForm.links.length >= MAX_LINKS" class="hint">
          You can add up to {{ MAX_LINKS }} links.
        </p>
      </fieldset>
      </fieldset>
      <button type="submit" :disabled="prof.pending.value || !profileLoaded">
        {{ prof.pending.value ? 'Saving…' : 'Save profile' }}
      </button>
    </form>

    <section aria-labelledby="images-h">
      <h2 id="images-h">
        Avatar and banner
      </h2>
      <p v-if="!verified" class="hint">
        Verify your email to change your avatar or banner.
      </p>
      <template v-else>
        <SettingsProfileImageField kind="avatar" />
        <SettingsProfileImageField kind="banner" />
      </template>
    </section>

    <section aria-labelledby="adult-h">
      <h2 id="adult-h">
        Mature and adult content
      </h2>
      <template v-if="!confirmed">
        <p v-if="!verified" class="hint">
          Verify your email to change this setting.
        </p>
        <FormErrors :message="adult.message.value" />
        <label class="check">
          <input v-model="adultChecked" type="checkbox" name="adult_confirm" :disabled="!verified">
          I confirm I am 18 years of age or older
        </label>
        <button type="button" data-test="confirm-adult" :disabled="!verified || !adultChecked || adult.pending.value" @click="confirmAdult">
          Confirm
        </button>
      </template>
      <form v-else data-test="rating-form" novalidate @submit.prevent="saveRating">
        <FormErrors :message="rating.message.value" />
        <fieldset>
          <legend>Show content up to</legend>
          <label v-for="r in ratings" :key="r.value" class="check">
            <input v-model="maxRating" type="radio" name="max_rating" :value="r.value">
            {{ r.label }}
          </label>
          <p v-if="rating.fieldError('max_rating')" class="field__error">
            {{ rating.fieldError('max_rating') }}
          </p>
        </fieldset>
        <button type="submit" :disabled="rating.pending.value">
          {{ rating.pending.value ? 'Saving…' : 'Save' }}
        </button>
      </form>
    </section>
  </section>
</template>

<style scoped>
.settings { display: grid; gap: 2rem; max-width: 40rem; min-width: 0; }
form, section { display: grid; gap: 0.75rem; min-width: 0; }
fieldset { min-width: 0; margin: 0; border: 1px solid var(--border); border-radius: 0.4rem; display: grid; gap: 0.5rem; }
.field { display: grid; gap: 0.25rem; }
label { font-weight: 600; }
.check { display: flex; gap: 0.5rem; align-items: center; font-weight: normal; }
textarea { font: inherit; padding: 0.5rem 0.65rem; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 0.4rem; width: 100%; box-sizing: border-box; }
.bare { border: 0; padding: 0; }
.link-row { display: grid; gap: 0.5rem; min-width: 0; }
.field__error { margin: 0; color: var(--danger); font-size: 0.9rem; }
.hint { margin: 0; opacity: 0.8; }
</style>
