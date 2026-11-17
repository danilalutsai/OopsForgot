<script setup lang="ts">
import { initials } from '@oopsproof/shared'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'

const auth = useAuth()
const router = useRouter()
const letters = computed(() => (auth.profile ? initials(auth.profile.name, auth.profile.surname) : ''))

async function logOut() {
  await auth.logOut()
  await router.replace('/login')
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      class="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent"
      :aria-label="`${letters} ${$t('nav.account')}`.trim()"
    >
      {{ letters }}
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="8"
        class="z-20 w-36 rounded-xl border border-line bg-surface p-1 text-text shadow-lg"
      >
        <DropdownMenuItem
          class="cursor-pointer rounded-lg px-3 py-2 outline-none data-[highlighted]:bg-bg"
          @select="logOut"
        >
          {{ $t('nav.logOut') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
