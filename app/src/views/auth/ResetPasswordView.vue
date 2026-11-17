<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthCard from '../../components/AuthCard.vue'
import TextField from '../../components/TextField.vue'
import { useAuth } from '../../stores/auth'
import { authErrorKey } from './errors'

const auth = useAuth()
const router = useRouter()
const password = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

async function submit() {
  if (password.value.length < 8) return (error.value = 'auth.errors.weakPassword')
  if (busy.value) return
  busy.value = true
  const failed = await auth.setNewPassword(password.value)
  busy.value = false
  if (failed) error.value = authErrorKey(failed)
  else await router.replace('/')
}
</script>

<template>
  <!-- An expired or used link arrives without a session: nothing to save against. -->
  <AuthCard v-if="!auth.loggedIn" :title="$t('auth.linkExpiredTitle')">
    <p>{{ $t('auth.linkExpired') }}</p>
    <RouterLink to="/forgot-password" class="font-semibold text-accent">{{ $t('auth.newLink') }}</RouterLink>
  </AuthCard>
  <AuthCard v-else :title="$t('auth.newPasswordTitle')">
    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <TextField
        v-model="password"
        :label="$t('auth.newPassword')"
        type="password"
        autocomplete="new-password"
        :hint="$t('auth.passwordHint')"
      />
      <p v-if="error" role="alert" class="text-sm font-medium text-urgent-red">{{ $t(error) }}</p>
      <button
        type="submit"
        :disabled="busy"
        class="rounded-xl bg-accent py-3 font-semibold text-on-accent disabled:opacity-50"
      >
        {{ $t('auth.savePassword') }}
      </button>
    </form>
  </AuthCard>
</template>
