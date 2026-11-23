<script setup lang="ts">
import { Bell, BellOff } from '@lucide/vue'
import { formatDateTime } from '../format'
import { online } from '../online'
import { keepPushOff, usePushOff } from '../push/pushOff'

/** Offline and "notifications are off" notes above the Events. */
const props = defineProps<{ updatedAt: number }>()
const pushOff = usePushOff()
const lastUpdated = () => formatDateTime(props.updatedAt)
</script>

<template>
  <p v-if="!online" role="status" class="mx-4 mb-2 rounded-xl bg-line px-3 py-2 text-sm">
    {{ updatedAt ? $t('offline.banner', { when: lastUpdated() }) : $t('offline.bannerNever') }}
  </p>
  <section
    v-if="pushOff && online"
    aria-labelledby="push-off-title"
    class="relative mx-4 mb-3 overflow-hidden rounded-2xl border border-urgent-yellow/30 bg-linear-to-br from-urgent-yellow/15 via-urgent-yellow/5 to-transparent p-4"
  >
    <!-- a soft glow behind the bell -->
    <span
      aria-hidden="true"
      class="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-urgent-yellow/20 blur-2xl"
    />
    <div class="relative flex gap-3">
      <span
        aria-hidden="true"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-urgent-yellow/20 text-urgent-yellow-text ring-4 ring-urgent-yellow/10"
      >
        <BellOff :size="22" />
      </span>
      <div class="min-w-0 flex-1">
        <h2 id="push-off-title" class="font-semibold">{{ $t('push.offTitle') }}</h2>
        <p class="mt-0.5 text-sm text-muted">{{ $t('push.offBody') }}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <RouterLink
            to="/settings?open=push"
            class="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent"
          >
            <Bell :size="16" aria-hidden="true" />{{ $t('push.offTurnOn') }}
          </RouterLink>
          <button
            type="button"
            class="rounded-full border border-line px-4 py-2 text-sm font-semibold"
            @click="keepPushOff"
          >
            {{ $t('push.keepOff') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
