<script setup lang="ts">
import AppLogo from './AppLogo.vue'

defineProps<{ title: string }>()
</script>

<template>
  <div class="mx-auto flex w-full max-w-sm flex-col gap-5 px-4 py-10">
    <AppLogo />
    <h1 class="text-2xl font-bold">{{ title }}</h1>
    <slot />
  </div>
</template>
