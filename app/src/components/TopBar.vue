<script setup lang="ts">
import AppLogo from './AppLogo.vue'
import AvatarMenu from './AvatarMenu.vue'

defineProps<{ title?: string }>()
</script>

<template>
  <header class="flex items-center gap-2 px-4 pt-5 pb-2">
    <h1 v-if="!title" class="md:sr-only"><AppLogo /></h1>
    <h1 v-else class="text-[19px] font-bold">{{ title }}</h1>
    <span class="flex-1" />
    <slot name="actions" />
    <button type="button" class="text-xl text-muted" :aria-label="$t('nav.settings')">⚙︎</button>
    <AvatarMenu />
  </header>
</template>
