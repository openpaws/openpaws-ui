<script setup lang="ts">
definePageMeta({ middleware: 'guest' })
useHead({ title: 'Create account — OpenPaws' })
const auth = useAuthStore()
const form = reactive({ username: '', display_name: '', email: '', password: '', password_confirmation: '' })
const { pending, message, fieldError, run } = useFormError()

function submit() {
  return run(async () => {
    await auth.register({ ...form })
    await navigateTo('/')
  })
}
</script>

<template>
  <section class="auth-page">
    <h1>Create account</h1>
    <form novalidate @submit.prevent="submit">
      <FormErrors :message="message" />
      <FormTextField v-model="form.username" name="username" label="Username" autocomplete="username" required :error="fieldError('username')" />
      <FormTextField v-model="form.display_name" name="display_name" label="Display name" autocomplete="nickname" required :error="fieldError('display_name')" />
      <FormTextField v-model="form.email" name="email" type="email" label="Email" autocomplete="email" required :error="fieldError('email')" />
      <FormTextField v-model="form.password" name="password" type="password" label="Password" autocomplete="new-password" required :error="fieldError('password')" />
      <FormTextField v-model="form.password_confirmation" name="password_confirmation" type="password" label="Confirm password" autocomplete="new-password" required :error="fieldError('password_confirmation')" />
      <button type="submit" :disabled="pending">
        {{ pending ? 'Creating account…' : 'Create account' }}
      </button>
    </form>
    <p>Already registered? <NuxtLink to="/login">Log in</NuxtLink></p>
  </section>
</template>
