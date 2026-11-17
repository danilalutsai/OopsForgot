<script setup lang="ts">
import { useToasts } from '../stores/toasts'

const toasts = useToasts()
</script>

<template>
  <div
    v-if="toasts.current"
    role="status"
    class="fixed bottom-36 left-1/2 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-text py-2 pr-2 pl-4 text-sm text-bg shadow-lg md:bottom-8"
  >
    <span>{{ $t(toasts.current.key, toasts.current.params ?? {}) }}</span>
    <button
      v-if="toasts.current.undo"
      type="button"
      class="shrink-0 rounded-full px-3 py-1 font-semibold text-bg underline"
      @click="toasts.undo"
    >
      {{ $t('toasts.undo') }}
    </button>
    <span v-else class="pr-2" />
  </div>
</template>
