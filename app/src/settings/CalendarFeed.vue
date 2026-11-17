<script setup lang="ts">
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'
import { computed, ref } from 'vue'
import { INPUT } from '../items/ui'
import { blockedOffline } from '../online'
import { useAuth } from '../stores/auth'
import { useToasts } from '../stores/toasts'

const auth = useAuth()
const toasts = useToasts()
const busy = ref(false)
const confirmingReset = ref(false)

const link = computed(() =>
  auth.profile?.calendar_token
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?token=${auth.profile.calendar_token}`
    : null,
)

async function set(on: boolean) {
  if (blockedOffline()) return
  busy.value = true
  const failed = await auth.setCalendarFeed(on)
  busy.value = false
  if (failed) toasts.show('calendarFeed.failed')
}

async function copy() {
  if (!link.value) return
  await navigator.clipboard.writeText(link.value)
  toasts.show('calendarFeed.copied')
}
</script>

<template>
  <div class="flex flex-col gap-3 text-sm">
    <p class="text-muted">{{ $t('calendarFeed.intro') }}</p>
    <button
      v-if="!link"
      type="button"
      class="self-start rounded-full bg-accent px-4 py-1.5 font-semibold text-on-accent disabled:opacity-50"
      :disabled="busy"
      @click="set(true)"
    >
      {{ $t('calendarFeed.setUp') }}
    </button>
    <template v-else>
      <label class="flex flex-col gap-1">
        <span class="font-medium">{{ $t('calendarFeed.link') }}</span>
        <input :value="link" readonly :class="INPUT" @focus="($event.target as HTMLInputElement).select()" />
      </label>
      <button
        type="button"
        class="self-start rounded-full bg-accent px-4 py-1.5 font-semibold text-on-accent"
        @click="copy"
      >
        {{ $t('calendarFeed.copy') }}
      </button>
      <p class="font-medium text-urgent-yellow-text">{{ $t('calendarFeed.warning') }}</p>
      <section>
        <h3 class="mb-1 font-semibold">{{ $t('calendarFeed.guidesTitle') }}</h3>
        <ul class="list-disc space-y-1 pl-5">
          <li>{{ $t('calendarFeed.google') }}</li>
          <li>{{ $t('calendarFeed.apple') }}</li>
          <li>{{ $t('calendarFeed.outlook') }}</li>
        </ul>
        <p class="mt-2 text-muted">{{ $t('calendarFeed.delay') }}</p>
      </section>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-full border border-line px-3 py-1.5 font-semibold"
          :disabled="busy"
          @click="confirmingReset = true"
        >
          {{ $t('calendarFeed.reset') }}
        </button>
        <button
          type="button"
          class="rounded-full border border-line px-3 py-1.5 font-semibold"
          :disabled="busy"
          @click="set(false)"
        >
          {{ $t('calendarFeed.turnOff') }}
        </button>
      </div>
    </template>
  </div>

  <AlertDialogRoot v-model:open="confirmingReset">
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-50 bg-black/40" />
      <AlertDialogContent
        class="fixed top-1/2 left-1/2 z-50 w-[min(90vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-5 text-text shadow-2xl"
      >
        <AlertDialogTitle class="text-lg font-semibold">{{ $t('calendarFeed.resetTitle') }}</AlertDialogTitle>
        <AlertDialogDescription class="mt-1 text-muted">{{ $t('calendarFeed.resetBody') }}</AlertDialogDescription>
        <div class="mt-5 flex flex-col gap-2">
          <AlertDialogAction class="rounded-xl bg-accent py-2.5 font-semibold text-on-accent" @click="set(true)">
            {{ $t('calendarFeed.reset') }}
          </AlertDialogAction>
          <AlertDialogCancel class="rounded-xl py-2.5 font-semibold text-accent">{{
            $t('calendarFeed.cancel')
          }}</AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
