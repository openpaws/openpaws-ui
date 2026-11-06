<script setup lang="ts">
definePageMeta({ middleware: 'guest' })
useHead({ title: 'Reset password — OpenPaws' })
const route = useRoute()
const form = reactive({
  token: String(route.query.token ?? ''),
  email: String(route.query.email ?? ''),
  password: '',
  password_confirmation: '',
})
const done = ref(false)
const { pending, message, fieldError, run } = useFormError()

function submit() {
  return run(async () => {
    await useApi()('/auth/password/reset', { method: 'POST', body: { ...form } })
    done.value = true
  })
}
</script>

<template>
  <section class="auth-page">
    <h1>Reset password</h1>
    <p v-if="done" role="status">
      Password updated. <NuxtLink to="/login">Log in</NuxtLink>
    </p>
    <form v-else novalidate @submit.prevent="submit">
      <FormErrors :message="message || fieldError('token')" />
      <FormTextField v-model="form.email" name="email" type="email" label="Email" autocomplete="email" required :error="fieldError('email')" />
      <FormTextField v-model="form.password" name="password" type="password" label="New password" autocomplete="new-password" required :error="fieldError('password')" />
      <FormTextField v-model="form.password_confirmation" name="password_confirmation" type="password" label="Confirm new password" autocomplete="new-password" required :error="fieldError('password_confirmation')" />
      <button type="submit" :disabled="pending">
        {{ pending ? 'Saving…' : 'Reset password' }}
      </button>
    </form>
  </section>
</template>
