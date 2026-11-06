<script setup lang="ts">
definePageMeta({ middleware: 'guest' })
useHead({ title: 'Log in — OpenPaws' })
const auth = useAuthStore()
const route = useRoute()
const form = reactive({ login: '', password: '', remember: false })
const { pending, message, fieldError, run } = useFormError()

function submit() {
  return run(async () => {
    await auth.login({ ...form })
    await navigateTo(safeNext(route.query.next))
  })
}
</script>

<template>
  <section class="auth-page">
    <h1>Log in</h1>
    <form novalidate @submit.prevent="submit">
      <FormErrors :message="message" />
      <FormTextField v-model="form.login" name="login" label="Username or email" autocomplete="username" required :error="fieldError('login')" />
      <FormTextField v-model="form.password" name="password" type="password" label="Password" autocomplete="current-password" required :error="fieldError('password')" />
      <label class="check"><input v-model="form.remember" type="checkbox" name="remember"> Remember me</label>
      <button type="submit" :disabled="pending">
        {{ pending ? 'Logging in…' : 'Log in' }}
      </button>
    </form>
    <p><NuxtLink to="/forgot-password">Forgot your password?</NuxtLink></p>
    <p>New here? <NuxtLink to="/register">Create an account</NuxtLink></p>
  </section>
</template>
