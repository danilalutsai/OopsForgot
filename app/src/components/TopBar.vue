<script setup lang="ts">
import { usePushOff } from '../push/pushOff'
import { timeZoneDiffers } from '../settings/timeZoneCheck'
import AppLogo from './AppLogo.vue'
import AvatarMenu from './AvatarMenu.vue'

defineProps<{ title?: string }>()
const pushOff = usePushOff()
</script>

<template>
  <header class="flex items-center gap-2 px-4 pt-5 pb-2">
    <h1 v-if="!title" class="md:sr-only"><AppLogo /></h1>
    <h1 v-else class="text-[19px] font-bold">{{ title }}</h1>
    <span class="flex-1" />
    <slot name="actions" />
    <RouterLink to="/settings" class="relative text-xl text-muted" :aria-label="$t('nav.settings')">
      ⚙︎
      <span
        v-if="timeZoneDiffers || pushOff"
        class="absolute -top-0.5 -right-1 h-2.5 w-2.5 rounded-full bg-urgent-yellow"
        :title="$t('settings.problem')"
      />
    </RouterLink>
    <AvatarMenu />
  </header>
</template>
