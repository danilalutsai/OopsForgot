<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { onBackFromAnotherSite, safeNext } from '../safeNext'
import { useAuth } from '../stores/auth'

const auth = useAuth()
const route = useRoute()
const error = ref(false)
const busy = ref(false)

let stop = () => {}
onMounted(() => (stop = onBackFromAnotherSite(() => (busy.value = false))))
onUnmounted(() => stop())

async function go() {
  error.value = false
  busy.value = true
  const failed = await auth.signInWithGoogle(safeNext(route.query.next))
  // on success the browser is already leaving for Google
  if (failed) {
    busy.value = false
    error.value = true
  }
}
</script>

<template>
  <button
    type="button"
    :disabled="busy"
    class="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface py-3 font-semibold disabled:opacity-50"
    @click="go"
  >
    <svg aria-hidden="true" viewBox="0 0 48 48" class="h-5 w-5">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.6 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.8l7.8-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.4 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z"
      />
    </svg>
    {{ $t('auth.google') }}
  </button>
  <p v-if="error" role="alert" class="text-sm font-medium text-urgent-red">{{ $t('auth.errors.google') }}</p>
  <div class="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
    <span class="h-px flex-1 bg-line" />{{ $t('auth.or') }}<span class="h-px flex-1 bg-line" />
  </div>
</template>
