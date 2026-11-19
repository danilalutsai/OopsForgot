<script setup lang="ts">
import { ref } from 'vue'
import AuthCard from '../../components/AuthCard.vue'
import TextField from '../../components/TextField.vue'
import { useAuth } from '../../stores/auth'
import { authErrorKey } from './errors'

const auth = useAuth()
const email = ref('')
const sent = ref(false)
const error = ref<string | null>(null)
const busy = ref(false)

async function submit() {
  if (busy.value) return
  busy.value = true
  const failed = await auth.sendPasswordReset(email.value.trim())
  busy.value = false
  error.value = failed ? authErrorKey(failed, { sendsEmail: true }) : null
  sent.value = !failed
}
</script>

<template>
  <AuthCard :title="$t('auth.resetTitle')">
    <p v-if="sent">{{ $t('auth.resetSent', { email }) }}</p>
    <form v-else class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <p>{{ $t('auth.resetIntro') }}</p>
      <TextField v-model="email" :label="$t('auth.email')" type="email" autocomplete="email" />
      <p v-if="error" role="alert" class="text-sm font-medium text-urgent-red">{{ $t(error) }}</p>
      <button
        type="submit"
        :disabled="busy"
        class="rounded-xl bg-accent py-3 font-semibold text-on-accent disabled:opacity-50"
      >
        {{ $t('auth.sendLink') }}
      </button>
    </form>
    <RouterLink to="/login" class="text-sm text-accent">{{ $t('auth.backToLogIn') }}</RouterLink>
  </AuthCard>
</template>
