<script setup lang="ts">
import TopBar from '../components/TopBar.vue'
import { useAuth } from '../stores/auth'

const auth = useAuth()
</script>

<template>
  <TopBar />
  <div class="mx-4 mb-2 grid grid-cols-2 rounded-xl border border-line bg-bg p-1 text-sm" role="tablist">
    <span role="tab" aria-selected="true" class="rounded-lg bg-surface py-1.5 text-center font-semibold shadow-sm">
      {{ $t('items.list') }}
    </span>
    <span role="tab" aria-selected="false" class="py-1.5 text-center text-muted">{{ $t('items.calendar') }}</span>
  </div>
  <p class="px-6 py-10 text-center text-muted">{{ $t('items.empty', { name: auth.profile?.name ?? '' }) }}</p>
</template>
