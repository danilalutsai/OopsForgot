<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthCard from '../../components/AuthCard.vue'
import TextField from '../../components/TextField.vue'
import { useAuth } from '../../stores/auth'

/** After a Google signup: the names Google gave, to check, and the 16+ confirmation only the person can give. */
const auth = useAuth()
const router = useRouter()
const route = useRoute()
const name = ref(auth.profile?.name ?? '')
const surname = ref(auth.profile?.surname ?? '')
const age = ref(false)
const error = ref<string | null>(null)
const busy = ref(false)

async function submit() {
  error.value = null
  if (!name.value.trim() || !surname.value.trim()) return (error.value = 'auth.errors.required')
  if (!age.value) return (error.value = 'auth.errors.age')
  busy.value = true
  const failed = await auth.finishSignup(name.value, surname.value)
  busy.value = false
  if (failed) return (error.value = 'auth.errors.generic')
  const next = route.query.next
  await router.replace(typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/')
}

async function logOut() {
  await auth.logOut()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <AuthCard :title="name.trim() ? $t('auth.welcomeTitle', { name: name.trim() }) : $t('auth.welcomeNoName')">
    <p>{{ $t('auth.welcomeIntro') }}</p>
    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <div class="grid grid-cols-2 gap-3">
        <TextField v-model="name" :label="$t('auth.name')" autocomplete="given-name" />
        <TextField v-model="surname" :label="$t('auth.surname')" autocomplete="family-name" />
      </div>
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
        {{ $t('auth.continue') }}
      </button>
    </form>
    <button type="button" class="text-sm text-accent" @click="logOut">{{ $t('auth.notSixteen') }}</button>
  </AuthCard>
</template>
