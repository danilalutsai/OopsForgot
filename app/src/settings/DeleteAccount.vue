<script setup lang="ts">
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'reka-ui'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { INPUT } from '../items/ui'
import { blockedOffline } from '../online'
import { onBackFromAnotherSite } from '../safeNext'
import { useAuth } from '../stores/auth'
import { supabase } from '../supabase'

const auth = useAuth()
const router = useRouter()
const route = useRoute()
const open = ref(false)
const password = ref('')
const typed = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  password.value = typed.value = ''
  error.value = null
})

// A Google-only account has no password to type: the person signs in with Google again and
// comes back here with the dialog open, and has a few minutes to finish.
const BACK_FROM_GOOGLE = 'delete-account'
let stop = () => {}
onUnmounted(() => stop())
onMounted(() => {
  stop = onBackFromAnotherSite(() => (busy.value = false))
  if (route.query.then !== BACK_FROM_GOOGLE) return
  void router.replace({ query: {} })
  open.value = true
})
async function googleAgain() {
  if (blockedOffline()) return
  busy.value = true
  const failed = await auth.signInWithGoogle(`${route.path}?then=${BACK_FROM_GOOGLE}`)
  if (failed) {
    busy.value = false
    error.value = 'auth.errors.google'
  }
}

async function deleteAccount() {
  if (blockedOffline()) return
  if (typed.value !== 'DELETE') return (error.value = 'deleteAccount.errors.confirm')
  busy.value = true
  error.value = null
  const { error: failed } = await supabase.functions.invoke('delete-account', {
    body: { password: password.value, confirm: typed.value },
  })
  if (failed) {
    busy.value = false
    const status = (failed as { context?: Response }).context?.status
    if (status === 403)
      error.value = auth.hasPassword ? 'deleteAccount.errors.password' : 'deleteAccount.errors.signInAgain'
    else error.value = 'deleteAccount.errors.failed'
    return
  }
  // the account is gone: clear this device too (saved copy, push, session)
  await auth.logOut()
  // told through page state, not the address, so a link can't fake it
  await router.replace({ name: 'login', state: { accountDeleted: true } })
}
</script>

<template>
  <!-- while deleting, the dialog can't be closed: the outcome must be seen -->
  <AlertDialogRoot :open="open" @update:open="(o) => !busy && (open = o)">
    <AlertDialogTrigger as-child>
      <button
        type="button"
        class="flex w-full justify-between rounded-xl px-3 py-3 text-left font-semibold text-urgent-red-text hover:bg-bg"
      >
        {{ $t('deleteAccount.line') }}
      </button>
    </AlertDialogTrigger>
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-50 bg-black/40" />
      <AlertDialogContent
        class="fixed top-1/2 left-1/2 z-50 w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-5 text-text shadow-2xl"
      >
        <AlertDialogTitle class="text-lg font-semibold">{{ $t('deleteAccount.title') }}</AlertDialogTitle>
        <AlertDialogDescription class="mt-1 text-muted">{{ $t('deleteAccount.body') }}</AlertDialogDescription>
        <form class="mt-4 flex flex-col gap-3 text-sm" novalidate @submit.prevent="deleteAccount">
          <label v-if="auth.hasPassword" class="flex flex-col gap-1">
            <span class="font-medium">{{ $t('deleteAccount.password') }}</span>
            <input v-model="password" type="password" autocomplete="current-password" :class="INPUT" />
          </label>
          <template v-else>
            <p>{{ $t('deleteAccount.googleAgain') }}</p>
            <button
              type="button"
              :disabled="busy"
              class="rounded-xl border border-line py-2.5 font-semibold disabled:opacity-40"
              @click="googleAgain"
            >
              {{ $t('deleteAccount.googleButton') }}
            </button>
          </template>
          <label class="flex flex-col gap-1">
            <span class="font-medium">{{ $t('deleteAccount.type') }}</span>
            <input v-model="typed" autocomplete="off" autocapitalize="characters" :class="INPUT" />
          </label>
          <p v-if="error" role="alert" class="font-medium text-urgent-red-text">{{ $t(error) }}</p>
          <button
            type="submit"
            :disabled="busy || (auth.hasPassword && !password)"
            class="rounded-xl bg-urgent-red py-2.5 font-semibold text-white disabled:opacity-40"
          >
            {{ $t('deleteAccount.confirm') }}
          </button>
          <AlertDialogCancel :disabled="busy" class="rounded-xl py-2.5 font-semibold text-accent disabled:opacity-40">{{
            $t('deleteAccount.cancel')
          }}</AlertDialogCancel>
        </form>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
