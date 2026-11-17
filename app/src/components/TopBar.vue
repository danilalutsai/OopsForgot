<script setup lang="ts">
import AppLogo from './AppLogo.vue'

defineProps<{ title?: string }>()
</script>

<template>
  <header class="flex items-center gap-2 px-4 pt-5 pb-2">
    <h1 v-if="!title" class="md:sr-only"><AppLogo /></h1>
    <h1 v-else class="text-[19px] font-bold">{{ title }}</h1>
    <span class="flex-1" />
    <slot name="actions" />
    <button type="button" class="text-xl text-muted" :aria-label="$t('nav.settings')">⚙︎</button>
    <button
      type="button"
      class="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent"
      :aria-label="$t('nav.account')"
    />
  </header>
</template>
