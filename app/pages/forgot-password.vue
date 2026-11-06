<script setup lang="ts">
definePageMeta({ middleware: 'guest' })
useHead({ title: 'Forgot password — OpenPaws' })
const email = ref('')
const sent = ref(false)
const { pending, message, fieldError, run } = useFormError()

function submit() {
  return run(async () => {
    await useApi()('/auth/password/forgot', { method: 'POST', body: { email: email.value } })
    sent.value = true
  })
}
</script>

<template>
  <section class="auth-page">
    <h1>Forgot password</h1>
    <p v-if="sent" role="status">
      If that email belongs to an account, a reset link is on its way.
    </p>
    <form v-else novalidate @submit.prevent="submit">
      <FormErrors :message="message" />
      <FormTextField v-model="email" name="email" type="email" label="Email" autocomplete="email" required :error="fieldError('email')" />
      <button type="submit" :disabled="pending">
        {{ pending ? 'Sending…' : 'Send reset link' }}
      </button>
    </form>
    <p><NuxtLink to="/login">Back to log in</NuxtLink></p>
  </section>
</template>
