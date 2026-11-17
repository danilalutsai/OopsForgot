<script setup lang="ts">
import { initials } from '@oopsproof/shared'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'

const auth = useAuth()
const router = useRouter()
const open = ref(false)
const root = ref<HTMLElement>()
const letters = computed(() => (auth.profile ? initials(auth.profile.name, auth.profile.surname) : ''))

const closeOutside = (e: PointerEvent) => {
  if (!root.value?.contains(e.target as Node)) open.value = false
}
document.addEventListener('pointerdown', closeOutside)
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOutside))

async function logOut() {
  open.value = false
  await auth.logOut()
  await router.replace('/login')
}
</script>

<template>
  <div ref="root" class="relative ml-2">
    <button
      type="button"
      class="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent"
      :aria-label="`${letters} ${$t('nav.account')}`"
      :aria-expanded="open"
      @click="open = !open"
    >
      {{ letters }}
    </button>
    <div
      v-if="open"
      role="menu"
      class="absolute right-0 z-20 mt-2 w-36 rounded-xl border border-line bg-surface p-1 shadow-lg"
    >
      <button type="button" role="menuitem" class="w-full rounded-lg px-3 py-2 text-left hover:bg-bg" @click="logOut">
        {{ $t('nav.logOut') }}
      </button>
    </div>
  </div>
</template>
