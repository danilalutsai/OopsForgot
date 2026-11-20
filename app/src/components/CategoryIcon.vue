<script setup lang="ts">
import type { Category } from '@oopsforgot/shared'
import { Car, CreditCard, Hourglass, House, IdCard, Pin, Plane, Repeat, ShoppingBag, Stethoscope } from '@lucide/vue'

/** A Category's line icon. Decoration only: the Category's name is always shown or read beside it. */
withDefaults(defineProps<{ category: Category; size?: number }>(), { size: 20 })

const ICONS = {
  documents: IdCard,
  cards: CreditCard,
  subscriptions: Repeat,
  free_trials: Hourglass,
  vehicle: Car,
  home: House,
  health: Stethoscope,
  purchases: ShoppingBag,
  travel: Plane,
  other: Pin,
} satisfies Record<Category, unknown>
</script>

<template>
  <component
    :is="ICONS[category]"
    :size="size"
    :stroke-width="1.75"
    class="shrink-0"
    aria-hidden="true"
    :data-category="category"
  />
</template>
