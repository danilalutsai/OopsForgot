<script setup lang="ts">
import { formatDateTime } from '../format'
import { online } from '../online'
import { usePushOff } from '../push/pushOff'

/** Offline and "notifications are off" notes above the Events. */
const props = defineProps<{ updatedAt: number }>()
const pushOff = usePushOff()
const lastUpdated = () => formatDateTime(props.updatedAt)
</script>

<template>
  <p v-if="!online" role="status" class="mx-4 mb-2 rounded-xl bg-line px-3 py-2 text-sm">
    {{ updatedAt ? $t('offline.banner', { when: lastUpdated() }) : $t('offline.bannerNever') }}
  </p>
  <p v-if="pushOff && online" class="mx-4 mb-2 rounded-xl bg-urgent-yellow/15 px-3 py-2 text-sm">
    {{ $t('push.offBanner') }}
    <RouterLink to="/settings" class="font-semibold text-accent underline">{{ $t('push.offBannerLink') }}</RouterLink>
  </p>
</template>
