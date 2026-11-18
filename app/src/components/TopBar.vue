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
    <RouterLink
      to="/settings"
      class="relative rounded-full p-1.5 text-muted hover:text-text"
      :aria-label="$t('nav.settings')"
    >
      <!-- a drawn gear: the text one is tiny in some fonts -->
      <svg
        viewBox="0 0 24 24"
        class="h-6 w-6"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path
          d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
        />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span
        v-if="timeZoneDiffers || pushOff"
        class="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-urgent-yellow"
        :title="$t('settings.problem')"
      />
    </RouterLink>
    <AvatarMenu />
  </header>
</template>
