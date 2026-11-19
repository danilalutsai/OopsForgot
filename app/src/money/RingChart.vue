<script setup lang="ts">
import type { Category } from '@oopsforgot/shared'
import { computed } from 'vue'
import { CATEGORY_COLORS } from './colors'

const props = defineProps<{
  parts: { category: Category; cents: number }[]
  selected: Category | null
  label: string
  /** bills still due later this month, shown as a grey part after the spent ones */
  coming?: number
}>()
defineEmits<{ pick: [category: Category] }>()

const R = 70
const C = 2 * Math.PI * R
/** One arc per Category, in order around the ring, starting at the top. */
const total = computed(() => props.parts.reduce((s, p) => s + p.cents, 0) + (props.coming ?? 0))
const arcs = computed(() => {
  let start = 0
  return props.parts.map((p) => {
    const length = total.value ? (p.cents / total.value) * C : 0
    const arc = { ...p, dash: `${Math.max(0, length - 2)} ${C}`, offset: -start }
    start += length
    return arc
  })
})
const comingArc = computed(() => {
  if (!props.coming || !total.value) return null
  const start = (1 - props.coming / total.value) * C
  return { dash: `${Math.max(0, C - start - 2)} ${C}`, offset: -start }
})
</script>

<template>
  <svg viewBox="0 0 180 180" class="mx-auto h-48 w-48" role="img" :aria-label="label">
    <circle cx="90" cy="90" :r="R" fill="none" class="stroke-line" stroke-width="18" />
    <circle
      v-for="a in arcs"
      :key="a.category"
      cx="90"
      cy="90"
      :r="R"
      fill="none"
      :stroke="CATEGORY_COLORS[a.category]"
      :stroke-width="selected === a.category ? 24 : 18"
      :stroke-dasharray="a.dash"
      :stroke-dashoffset="a.offset"
      :opacity="selected && selected !== a.category ? 0.35 : 1"
      transform="rotate(-90 90 90)"
      class="cursor-pointer"
      @click="$emit('pick', a.category)"
    />
    <circle
      v-if="comingArc"
      cx="90"
      cy="90"
      :r="R"
      fill="none"
      class="stroke-urgent-grey"
      stroke-width="18"
      :stroke-dashoffset="comingArc.offset"
      :style="{ strokeDasharray: comingArc.dash }"
      transform="rotate(-90 90 90)"
      opacity="0.6"
    />
    <slot />
  </svg>
</template>
