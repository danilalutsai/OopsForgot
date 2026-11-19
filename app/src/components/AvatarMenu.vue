<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'
import { useRouter } from 'vue-router'
import { usePushOff } from '../push/pushOff'
import { timeZoneDiffers } from '../settings/timeZoneCheck'
import { useAuth } from '../stores/auth'
import AvatarImage from './AvatarImage.vue'

const auth = useAuth()
const router = useRouter()
const pushOff = usePushOff()

async function logOut() {
  await auth.logOut()
  await router.replace('/login')
}

const ITEM = 'cursor-pointer rounded-lg px-3 py-2 outline-none data-[highlighted]:bg-bg'
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      class="relative ml-1 flex h-11 w-11 items-center justify-center rounded-full md:ml-2 md:h-auto md:w-auto"
      :aria-label="`${auth.initials} ${$t('nav.accountMenu')}`.trim()"
    >
      <AvatarImage />
      <span
        v-if="timeZoneDiffers || pushOff"
        class="absolute top-0 right-0 h-3 w-3 md:-top-0.5 md:-right-0.5 rounded-full border-2 border-bg bg-urgent-yellow"
        :title="$t('settings.problem')"
      />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="8"
        class="z-20 w-44 rounded-xl border border-line bg-surface p-1 text-text shadow-lg"
      >
        <DropdownMenuItem :class="ITEM" @select="router.push('/account')">{{ $t('nav.account') }}</DropdownMenuItem>
        <DropdownMenuItem :class="[ITEM, 'flex items-center justify-between']" @select="router.push('/settings')">
          {{ $t('nav.settings') }}
          <span
            v-if="timeZoneDiffers || pushOff"
            class="h-2 w-2 rounded-full bg-urgent-yellow"
            :title="$t('settings.problem')"
          />
        </DropdownMenuItem>
        <DropdownMenuSeparator class="my-1 h-px bg-line" />
        <DropdownMenuItem :class="ITEM" @select="logOut">{{ $t('nav.logOut') }}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
