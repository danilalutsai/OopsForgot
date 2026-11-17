<script setup lang="ts">
import AppLogo from '../components/AppLogo.vue'

// TODO(owner): replace with the app's contact address before launch.
const contact = '(contact email coming soon)'
const owner = 'Danila Lutsai'
const sections = ['who', 'what', 'why', 'where', 'howLong', 'rights'] as const
</script>

<template>
  <article class="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-10">
    <AppLogo />
    <h1 class="text-2xl font-bold">{{ $t('privacy.title') }}</h1>
    <p class="text-sm text-muted">{{ $t('privacy.updated') }}</p>
    <section v-for="s in sections" :key="s">
      <h2 class="mb-1 font-semibold">{{ $t(`privacy.${s}Title`) }}</h2>
      <p>{{ $t(`privacy.${s}`, { owner, contact }) }}</p>
    </section>
    <p class="font-medium">{{ $t('privacy.noTracking') }}</p>
  </article>
</template>
