<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'
import AvatarImage from './AvatarImage.vue'

const auth = useAuth()
const router = useRouter()

async function logOut() {
  await auth.logOut()
  await router.replace('/login')
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger class="ml-2 rounded-full" :aria-label="`${auth.initials} ${$t('nav.account')}`.trim()">
      <AvatarImage />
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
