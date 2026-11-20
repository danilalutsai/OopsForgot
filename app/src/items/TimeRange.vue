<script setup lang="ts">
import { watch } from 'vue'
import DateTimeInput from '../components/DateTimeInput.vue'

/**
 * Start and Finish time, stacked. No Start means all day; a Finish needs a Start, and "All day"
 * takes both away.
 */
defineProps<{ hintId?: string }>()
const start = defineModel<string>('start', { required: true })
const finish = defineModel<string>('finish', { required: true })

// no Finish without a Start
watch(start, (value) => {
  if (!value) finish.value = ''
})
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3 text-sm">
    <div class="flex items-end gap-2">
      <label class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="font-medium">{{ $t('itemForm.startTime') }}</span>
        <DateTimeInput
          v-model="start"
          type="time"
          :aria-label="$t('itemForm.startTime')"
          :aria-describedby="hintId"
          :placeholder="$t('itemForm.allDay')"
        />
      </label>
      <button
        v-if="start"
        type="button"
        class="min-h-[2.875rem] shrink-0 rounded-xl border border-line px-3"
        @click="start = ''"
      >
        {{ $t('itemForm.allDay') }}
      </button>
    </div>
    <label class="flex min-w-0 flex-col gap-1">
      <span class="font-medium">{{ $t('itemForm.finishTime') }}</span>
      <DateTimeInput
        v-model="finish"
        type="time"
        :disabled="!start"
        :aria-label="$t('itemForm.finishTime')"
        :placeholder="start ? $t('itemForm.finishOptional') : $t('itemForm.finishNeedsStart')"
      />
    </label>
  </div>
</template>
