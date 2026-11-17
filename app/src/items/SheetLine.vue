<script setup lang="ts">
import { heightTransition } from '../motion'

defineProps<{ label: string; value: string; open: boolean }>()
defineEmits<{ toggle: [] }>()
</script>

<template>
  <div>
    <button
      type="button"
      :aria-expanded="open"
      :class="[
        'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-bg',
        open && 'bg-bg',
      ]"
      @click="$emit('toggle')"
    >
      <span class="text-muted">{{ label }}</span>
      <span class="truncate text-right font-medium">{{ value }}</span>
    </button>
    <Transition :css="false" @enter="heightTransition.onEnter" @leave="heightTransition.onLeave">
      <div v-if="open" class="overflow-hidden">
        <div class="px-3 pt-1 pb-3"><slot /></div>
      </div>
    </Transition>
  </div>
</template>
