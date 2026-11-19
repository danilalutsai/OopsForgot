<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useToasts } from '../stores/toasts'

// An open sheet hides the rest of the app from screen readers, so while one is open the
// message shows inside it (inSheet) and the app-wide bar steps aside.
const props = defineProps<{ inSheet?: boolean }>()
const toasts = useToasts()
onMounted(() => props.inSheet && toasts.sheetsOpen++)
onBeforeUnmount(() => props.inSheet && toasts.sheetsOpen--)
</script>

<template>
  <div
    v-if="inSheet || !toasts.sheetsOpen"
    role="status"
    class="pointer-events-none fixed inset-x-0 bottom-36 z-[60] flex justify-center md:bottom-8"
  >
    <div
      v-if="toasts.current"
      class="pointer-events-auto flex w-max max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-line bg-raised py-2 pr-2 pl-4 text-sm font-medium text-text shadow-xl shadow-black/25"
    >
      <span class="min-w-0">{{ $t(toasts.current.key, toasts.current.params ?? {}) }}</span>
      <button
        v-if="toasts.current.undo"
        type="button"
        class="shrink-0 rounded-full border border-accent/50 px-3 py-1 font-semibold text-accent hover:bg-accent/10"
        @click="toasts.undo"
      >
        {{ $t('toasts.undo') }}
      </button>
      <span v-else class="pr-2" />
    </div>
  </div>
</template>
