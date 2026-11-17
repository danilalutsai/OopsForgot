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
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { INPUT } from '../items/ui'
import { blockedOffline } from '../online'
import { useAuth } from '../stores/auth'
import { supabase } from '../supabase'

const auth = useAuth()
const router = useRouter()
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
    error.value = status === 403 ? 'deleteAccount.errors.password' : 'deleteAccount.errors.failed'
    return
  }
  // the account is gone: clear this device too (saved copy, push, session)
  await auth.logOut()
  await router.replace({ name: 'login', query: { deleted: '1' } })
}
</script>

<template>
  <AlertDialogRoot v-model:open="open">
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
          <label class="flex flex-col gap-1">
            <span class="font-medium">{{ $t('deleteAccount.password') }}</span>
            <input v-model="password" type="password" autocomplete="current-password" :class="INPUT" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="font-medium">{{ $t('deleteAccount.type') }}</span>
            <input v-model="typed" autocomplete="off" autocapitalize="characters" :class="INPUT" />
          </label>
          <p v-if="error" role="alert" class="font-medium text-urgent-red-text">{{ $t(error) }}</p>
          <button
            type="submit"
            :disabled="busy || typed !== 'DELETE' || !password"
            class="rounded-xl bg-urgent-red py-2.5 font-semibold text-white disabled:opacity-40"
          >
            {{ $t('deleteAccount.confirm') }}
          </button>
          <AlertDialogCancel class="rounded-xl py-2.5 font-semibold text-accent">{{
            $t('deleteAccount.cancel')
          }}</AlertDialogCancel>
        </form>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
