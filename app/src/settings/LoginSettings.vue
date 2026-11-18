<script setup lang="ts">
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'reka-ui'
import type { AuthError, PostgrestError } from '@supabase/supabase-js'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import SheetLine from '../items/SheetLine.vue'
import { INPUT } from '../items/ui'
import { blockedOffline } from '../online'
import { onBackFromAnotherSite } from '../safeNext'
import { useAuth } from '../stores/auth'
import { useToasts } from '../stores/toasts'

/** How the person logs in: email, password, Google, and logging out everywhere. */
const props = defineProps<{ openLine: string | null }>()
const emit = defineEmits<{ toggle: [line: string] }>()

const auth = useAuth()
const router = useRouter()
const toasts = useToasts()
const error = ref<string | null>(null)
const busy = ref(false)
const newEmail = ref('')
const currentPassword = ref('')
const newPassword = ref('')

// a line opens clean
watch(
  () => props.openLine,
  () => {
    error.value = null
    newEmail.value = currentPassword.value = newPassword.value = ''
  },
)

let stop = () => {}
onMounted(() => (stop = onBackFromAnotherSite(() => (busy.value = false))))
onUnmounted(() => stop())

/** Runs one change; returns whether it worked, showing the error otherwise. */
async function run(change: () => Promise<AuthError | PostgrestError | null>, errorKey: (e: AuthError) => string) {
  if (blockedOffline()) return false
  error.value = null
  busy.value = true
  const failed = await change()
  busy.value = false
  if (failed) error.value = errorKey(failed as AuthError)
  return !failed
}

const failed = () => 'login.errors.failed'

async function saveEmail() {
  const email = newEmail.value.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return (error.value = 'login.errors.email')
  const ok = await run(
    () => auth.changeEmail(email),
    (e) => (e.code === 'email_exists' ? 'login.errors.emailTaken' : failed()),
  )
  if (ok) {
    newEmail.value = ''
    toasts.show('login.emailSent')
  }
}

async function savePassword() {
  if (newPassword.value.length < 8) return (error.value = 'login.errors.weakPassword')
  const adding = !auth.hasPassword
  const ok = await run(
    () => auth.changePassword(newPassword.value, adding ? undefined : currentPassword.value),
    (e) => {
      if (e.code === 'invalid_credentials') return 'login.errors.wrongPassword'
      if (e.code === 'weak_password' || e.code === 'same_password') return 'login.errors.weakPassword'
      return failed()
    },
  )
  if (ok) {
    emit('toggle', 'password')
    toasts.show('login.passwordSaved')
  }
}

async function connectGoogle() {
  // on success the browser is already leaving for Google
  await run(() => auth.connectGoogle(), failed)
}

async function disconnectGoogle() {
  if (await run(() => auth.disconnectGoogle(), failed)) toasts.show('login.googleDisconnected')
}

async function logOutEverywhere() {
  if (await run(() => auth.logOutEverywhere(), failed)) await router.replace({ name: 'login' })
}
</script>

<template>
  <p v-if="error" role="alert" class="mx-3 my-2 rounded-xl bg-urgent-red/10 p-3 text-sm font-medium text-urgent-red">
    {{ $t(error) }}
  </p>

  <SheetLine
    :label="$t('login.email')"
    :value="auth.session?.user.email ?? ''"
    :open="openLine === 'email'"
    @toggle="emit('toggle', 'email')"
  >
    <p v-if="auth.pendingEmail" class="mb-3 rounded-xl bg-bg p-3 text-sm">
      <span class="font-semibold">{{ $t('login.emailPending', { email: auth.pendingEmail }) }}</span>
      <br />
      {{ $t('login.emailPendingHint', { old: auth.session?.user.email, new: auth.pendingEmail }) }}
    </p>
    <form class="flex flex-col gap-2 text-sm" novalidate @submit.prevent="saveEmail">
      <label class="flex flex-col gap-1">
        <span class="font-medium">{{ $t('login.newEmail') }}</span>
        <input v-model="newEmail" type="email" autocomplete="email" :class="INPUT" />
      </label>
      <p class="text-muted">{{ $t('login.emailHint') }}</p>
      <button
        type="submit"
        :disabled="busy || !newEmail.trim()"
        class="self-start rounded-full bg-accent px-4 py-1.5 font-semibold text-on-accent disabled:opacity-40"
      >
        {{ $t('login.sendLinks') }}
      </button>
    </form>
  </SheetLine>

  <SheetLine
    :label="$t('login.password')"
    :value="auth.hasPassword ? $t('login.passwordSet') : $t('login.passwordNone')"
    :open="openLine === 'password'"
    @toggle="emit('toggle', 'password')"
  >
    <form class="flex flex-col gap-2 text-sm" novalidate @submit.prevent="savePassword">
      <label v-if="auth.hasPassword" class="flex flex-col gap-1">
        <span class="font-medium">{{ $t('login.currentPassword') }}</span>
        <input v-model="currentPassword" type="password" autocomplete="current-password" :class="INPUT" />
      </label>
      <label class="flex flex-col gap-1">
        <span class="font-medium">{{ $t('login.newPassword') }}</span>
        <input v-model="newPassword" type="password" autocomplete="new-password" :class="INPUT" />
      </label>
      <p class="text-muted">{{ auth.hasPassword ? $t('auth.passwordHint') : $t('login.addPasswordHint') }}</p>
      <button
        type="submit"
        :disabled="busy || !newPassword || (auth.hasPassword && !currentPassword)"
        class="self-start rounded-full bg-accent px-4 py-1.5 font-semibold text-on-accent disabled:opacity-40"
      >
        {{ auth.hasPassword ? $t('login.savePassword') : $t('login.addPassword') }}
      </button>
    </form>
  </SheetLine>

  <SheetLine
    :label="$t('login.google')"
    :value="auth.googleConnected ? $t('login.googleOn') : $t('login.googleOff')"
    :open="openLine === 'google'"
    @toggle="emit('toggle', 'google')"
  >
    <div class="flex flex-col gap-2 text-sm">
      <template v-if="!auth.googleConnected">
        <p class="text-muted">{{ $t('login.connectHint') }}</p>
        <button
          type="button"
          :disabled="busy"
          class="self-start rounded-full bg-accent px-4 py-1.5 font-semibold text-on-accent disabled:opacity-40"
          @click="connectGoogle"
        >
          {{ $t('login.connectGoogle') }}
        </button>
      </template>
      <template v-else-if="auth.hasPassword">
        <p class="text-muted">{{ $t('login.disconnectHint') }}</p>
        <button
          type="button"
          :disabled="busy"
          class="self-start rounded-full border border-line px-4 py-1.5 font-semibold text-urgent-red-text disabled:opacity-40"
          @click="disconnectGoogle"
        >
          {{ $t('login.disconnectGoogle') }}
        </button>
      </template>
      <p v-else class="text-muted">{{ $t('login.needPasswordFirst') }}</p>
    </div>
  </SheetLine>

  <AlertDialogRoot>
    <AlertDialogTrigger as-child>
      <button
        type="button"
        class="flex w-full justify-between rounded-xl px-3 py-3 text-left font-semibold hover:bg-bg"
      >
        {{ $t('login.logOutEverywhere') }}
      </button>
    </AlertDialogTrigger>
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-50 bg-black/40" />
      <AlertDialogContent
        class="fixed top-1/2 left-1/2 z-50 w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-5 text-text shadow-2xl"
      >
        <AlertDialogTitle class="text-lg font-semibold">{{ $t('login.logOutEverywhereConfirm') }}</AlertDialogTitle>
        <AlertDialogDescription class="mt-1 text-muted">{{ $t('login.logOutEverywhereHint') }}</AlertDialogDescription>
        <div class="mt-4 flex flex-col gap-2">
          <AlertDialogAction class="rounded-xl bg-accent py-2.5 font-semibold text-on-accent" @click="logOutEverywhere">
            {{ $t('login.logOutEverywhereYes') }}
          </AlertDialogAction>
          <AlertDialogCancel class="rounded-xl py-2.5 font-semibold text-accent">{{
            $t('login.cancel')
          }}</AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
