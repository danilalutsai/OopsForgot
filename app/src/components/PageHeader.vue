<script setup lang="ts">
import AvatarMenu from './AvatarMenu.vue'

/** Header of a settings-style page: Back on phones, the title, and the avatar menu to switch pages. */
defineProps<{ title: string }>()
</script>

<template>
  <header class="flex items-center gap-2 px-4 pt-5 pb-2">
    <span class="w-16 md:hidden">
      <RouterLink to="/" class="text-accent">‹ {{ $t('settings.back') }}</RouterLink>
    </span>
    <h1 class="flex-1 text-center text-[19px] font-bold md:text-left">{{ title }}</h1>
    <span class="flex w-16 justify-end md:w-auto"><AvatarMenu /></span>
  </header>
</template>
