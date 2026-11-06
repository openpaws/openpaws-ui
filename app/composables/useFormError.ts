import { ApiError } from '~/utils/apiError'

export const THROTTLE_MESSAGE = 'Too many attempts — try again in a few minutes.'

/** Form-submission state: pending flag, per-field messages and a general message. */
export function useFormError() {
  const pending = ref(false)
  const message = ref('')
  const fields = ref<Record<string, string[]>>({})

  const fieldError = (name: string) => fields.value[name]?.[0]

  function clear() {
    message.value = ''
    fields.value = {}
  }

  function setError(e: unknown) {
    clear()
    if (e instanceof ApiError) {
      if (e.status === 429) message.value = THROTTLE_MESSAGE
      else {
        fields.value = e.fields
        if (!Object.keys(e.fields).length) message.value = e.message
      }
    }
    else message.value = 'Something went wrong. Please try again.'
  }

  async function run(fn: () => Promise<void>) {
    if (pending.value) return
    pending.value = true
    clear()
    try {
      await fn()
    }
    catch (e) {
      setError(e)
    }
    finally {
      pending.value = false
    }
  }

  return { pending, message, fields, fieldError, run, setError, clear }
}
