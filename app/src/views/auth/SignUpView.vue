<script setup lang="ts">
import { ref } from 'vue'
import AuthCard from '../../components/AuthCard.vue'
import GoogleButton from '../../components/GoogleButton.vue'
import TextField from '../../components/TextField.vue'
import { useAuth } from '../../stores/auth'
import { authErrorKey } from './errors'

const auth = useAuth()
const name = ref('')
const surname = ref('')
const email = ref('')
const password = ref('')
const age = ref(false)
const error = ref<string | null>(null)
const sent = ref(false)
const busy = ref(false)

async function submit() {
  error.value = null
  if (!name.value.trim() || !surname.value.trim() || !email.value.trim()) return (error.value = 'auth.errors.required')
  if (password.value.length < 8) return (error.value = 'auth.errors.weakPassword')
  if (!age.value) return (error.value = 'auth.errors.age')
  busy.value = true
  const failed = await auth.signUp({
    email: email.value.trim(),
    password: password.value,
    name: name.value,
    surname: surname.value,
  })
  busy.value = false
  if (failed) error.value = authErrorKey(failed, { sendsEmail: true })
  else sent.value = true
}
</script>

<template>
  <AuthCard v-if="sent" :title="$t('auth.checkEmailTitle', { name: name.trim() })">
    <p>{{ $t('auth.checkEmail', { email }) }}</p>
    <RouterLink to="/login" class="font-semibold text-accent">{{ $t('auth.backToLogIn') }}</RouterLink>
  </AuthCard>
  <AuthCard v-else :title="$t('auth.signUpTitle')">
    <GoogleButton />
    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <div class="grid grid-cols-2 gap-3">
        <TextField v-model="name" :label="$t('auth.name')" autocomplete="given-name" />
        <TextField v-model="surname" :label="$t('auth.surname')" autocomplete="family-name" />
      </div>
      <TextField v-model="email" :label="$t('auth.email')" type="email" autocomplete="email" />
      <TextField
        v-model="password"
        :label="$t('auth.password')"
        type="password"
        autocomplete="new-password"
        :hint="$t('auth.passwordHint')"
      />
      <label class="flex items-center gap-2 text-sm">
        <input v-model="age" type="checkbox" class="h-4 w-4 accent-accent" />
        {{ $t('auth.age') }}
      </label>
      <p class="text-sm text-muted">
        <i18n-t keypath="auth.accept">
          <template #privacy>
            <RouterLink to="/privacy" class="underline">{{ $t('auth.privacyNotice') }}</RouterLink>
          </template>
        </i18n-t>
      </p>
      <p v-if="error" role="alert" class="text-sm font-medium text-urgent-red">{{ $t(error) }}</p>
      <button
        type="submit"
        :disabled="busy"
        class="rounded-xl bg-accent py-3 font-semibold text-on-accent disabled:opacity-50"
      >
        {{ $t('auth.signUp') }}
      </button>
    </form>
    <p class="text-sm">
      {{ $t('auth.haveAccount') }}
      <RouterLink to="/login" class="font-semibold text-accent">{{ $t('auth.logIn') }}</RouterLink>
    </p>
  </AuthCard>
</template>
