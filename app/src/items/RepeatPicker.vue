<script setup lang="ts">
import type { Recurrence } from '@oopsproof/shared'
import { computed, ref, watch } from 'vue'
import { INPUT } from './ui'

/** How often the Item repeats: null for a one-time Item, undefined while the custom count is invalid. */
const model = defineModel<Recurrence | null | undefined>({ required: true })

type Choice = 'none' | 'week' | 'month' | 'year' | 'custom'
const start = model.value
// undefined means a custom count that isn't valid yet: reopen on Custom with an empty box, never as "none"
const choice = ref<Choice>(
  start === undefined ? 'custom' : !start ? 'none' : start.every === 1 && start.unit !== 'day' ? start.unit : 'custom',
)
const customEvery = ref(start === undefined ? '' : start && choice.value === 'custom' ? String(start.every) : '2')
const customUnit = ref<Recurrence['unit']>(start && choice.value === 'custom' ? start.unit : 'month')

/** The custom repeat count when it is a plain whole number from 1 to 365, else null. */
const customCount = computed(() => {
  const text = customEvery.value.trim()
  const n = Number(text)
  return /^\d{1,3}$/.test(text) && n >= 1 && n <= 365 ? n : null
})

watch(
  [choice, customCount, customUnit],
  () => {
    if (choice.value === 'none') model.value = null
    else if (choice.value !== 'custom') model.value = { unit: choice.value, every: 1 }
    else model.value = customCount.value === null ? undefined : { unit: customUnit.value, every: customCount.value }
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex flex-col gap-2 text-sm">
    <label class="flex flex-col gap-1">
      <span class="font-medium">{{ $t('itemForm.repeats') }}</span>
      <select v-model="choice" :class="INPUT">
        <option v-for="o in ['none', 'week', 'month', 'year', 'custom'] as const" :key="o" :value="o">
          {{ $t(`itemForm.repeatOptions.${o}`) }}
        </option>
      </select>
    </label>
    <div v-if="choice === 'custom'" class="flex items-center gap-2">
      <span>{{ $t('itemForm.every') }}</span>
      <input v-model="customEvery" inputmode="numeric" :aria-label="$t('itemForm.every')" :class="[INPUT, '!w-20']" />
      <select v-model="customUnit" :aria-label="$t('itemForm.repeatUnit')" :class="INPUT">
        <option v-for="u in ['day', 'week', 'month', 'year'] as const" :key="u" :value="u">
          {{ $t(`itemForm.units.${u}`, customCount ?? 2) }}
        </option>
      </select>
    </div>
    <p v-if="choice !== 'none'" class="text-muted">{{ $t('itemForm.repeatHint') }}</p>
  </div>
</template>
