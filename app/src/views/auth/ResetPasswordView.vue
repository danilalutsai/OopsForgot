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

async function submit() {
  if (password.value.length < 8) return (error.value = 'auth.errors.weakPassword')
  const failed = await auth.setNewPassword(password.value)
  if (failed) error.value = authErrorKey(failed)
  else await router.replace('/')
}
</script>

<template>
  <AuthCard :title="$t('auth.newPasswordTitle')">
    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <TextField
        v-model="password"
        :label="$t('auth.newPassword')"
        type="password"
        autocomplete="new-password"
        :hint="$t('auth.passwordHint')"
      />
      <p v-if="error" role="alert" class="text-sm font-medium text-urgent-red">{{ $t(error) }}</p>
      <button type="submit" class="rounded-xl bg-accent py-3 font-semibold text-on-accent">
        {{ $t('auth.savePassword') }}
      </button>
    </form>
  </AuthCard>
</template>
