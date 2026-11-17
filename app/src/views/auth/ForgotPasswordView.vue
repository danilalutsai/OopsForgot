<script setup lang="ts">
import { ref } from 'vue'
import AuthCard from '../../components/AuthCard.vue'
import TextField from '../../components/TextField.vue'
import { useAuth } from '../../stores/auth'

const auth = useAuth()
const email = ref('')
const sent = ref(false)
const error = ref(false)

async function submit() {
  error.value = !!(await auth.sendPasswordReset(email.value.trim()))
  sent.value = !error.value
}
</script>

<template>
  <AuthCard :title="$t('auth.resetTitle')">
    <p v-if="sent">{{ $t('auth.resetSent', { email }) }}</p>
    <form v-else class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <p>{{ $t('auth.resetIntro') }}</p>
      <TextField v-model="email" :label="$t('auth.email')" type="email" autocomplete="email" />
      <p v-if="error" role="alert" class="text-sm font-medium text-urgent-red">{{ $t('auth.errors.generic') }}</p>
      <button type="submit" class="rounded-xl bg-accent py-3 font-semibold text-on-accent">
        {{ $t('auth.sendLink') }}
      </button>
    </form>
    <RouterLink to="/login" class="text-sm text-accent">{{ $t('auth.backToLogIn') }}</RouterLink>
  </AuthCard>
</template>
