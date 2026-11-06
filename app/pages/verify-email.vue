<script setup lang="ts">
useHead({ title: 'Verify email — OpenPaws' })
const route = useRoute()
const auth = useAuthStore()
const state = ref<'pending' | 'ok' | 'failed'>('pending')
const resent = ref(false)
const verify = useFormError()
const resend = useFormError()

onMounted(() => {
  void verify.run(async () => {
    const token = String(route.query.token ?? '')
    try {
      await useApi()('/auth/email/verify', { method: 'POST', body: { token } })
    }
    catch {
      state.value = 'failed'
      return
    }
    state.value = 'ok'
    await auth.fetchMe().catch(() => {})
  })
})

function doResend() {
  return resend.run(async () => {
    await useApi()('/auth/email/resend', { method: 'POST' })
    resent.value = true
  })
}
</script>

<template>
  <section class="auth-page">
    <h1>Verify email</h1>
    <p v-if="state === 'pending'" role="status">
      Verifying…
    </p>
    <p v-else-if="state === 'ok'" role="status">
      Email verified. Thanks!
    </p>
    <div v-else>
      <p>This verification link is expired or invalid.</p>
      <template v-if="auth.me">
        <p v-if="resent" role="status">
          A new link has been sent.
        </p>
        <FormErrors :message="resend.message.value" />
        <button type="button" :disabled="resend.pending.value" @click="doResend">
          Resend verification email
        </button>
      </template>
      <p v-else>
        <NuxtLink :to="`/login?next=${encodeURIComponent('/verify-email')}`">Log in</NuxtLink> to request a new link.
      </p>
    </div>
  </section>
</template>
