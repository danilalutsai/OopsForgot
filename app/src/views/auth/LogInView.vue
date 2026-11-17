<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthCard from '../../components/AuthCard.vue'
import TextField from '../../components/TextField.vue'
import { useAuth } from '../../stores/auth'
import { authErrorKey } from './errors'

const auth = useAuth()
const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

async function submit() {
  error.value = null
  busy.value = true
  const failed = await auth.logIn(email.value.trim(), password.value)
  busy.value = false
  if (failed) error.value = authErrorKey(failed)
  else {
    // only paths inside the app, never another site
    const next =
      typeof route.query.next === 'string' && route.query.next.startsWith('/') && !route.query.next.startsWith('//')
    await router.replace(next ? (route.query.next as string) : '/')
  }
}
</script>

<template>
  <AuthCard :title="$t('auth.logInTitle')">
    <p v-if="route.query.deleted" role="status" class="rounded-xl bg-bg p-3 text-sm">{{ $t('deleteAccount.done') }}</p>
    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <TextField v-model="email" :label="$t('auth.email')" type="email" autocomplete="email" />
      <TextField v-model="password" :label="$t('auth.password')" type="password" autocomplete="current-password" />
      <p v-if="error" role="alert" class="text-sm font-medium text-urgent-red">{{ $t(error) }}</p>
      <button
        type="submit"
        :disabled="busy"
        class="rounded-xl bg-accent py-3 font-semibold text-on-accent disabled:opacity-50"
      >
        {{ $t('auth.logIn') }}
      </button>
    </form>
    <RouterLink to="/forgot-password" class="text-sm text-accent">{{ $t('auth.forgot') }}</RouterLink>
    <p class="text-sm">
      {{ $t('auth.noAccount') }}
      <RouterLink to="/signup" class="font-semibold text-accent">{{ $t('auth.signUp') }}</RouterLink>
    </p>
  </AuthCard>
</template>
