<script setup lang="ts">
import { type Recurrence, type ReminderOffset, reminderChoices } from '@oopsforgot/shared'
import { computed } from 'vue'
import { formatTime } from '../format'
import { dayReminderTime, nowLocal } from '../today'

const props = defineProps<{ dueDate: string; dueTime: string | null; recurrence: Recurrence | null | undefined }>()
const model = defineModel<ReminderOffset[]>({ required: true })

const choices = computed(() =>
  reminderChoices(
    { dueDate: props.dueDate || '9999-12-31', dueTime: props.dueTime, recurrence: props.recurrence ?? null },
    nowLocal.value,
    dayReminderTime.value,
  ),
)
/** The chosen Reminders that will really be kept. */
const picked = computed(() => choices.value.filter((c) => c.allowed && model.value.includes(c.offset)))
/** One line per reason something is greyed out. */
const reasons = computed(() => [...new Set(choices.value.flatMap((c) => (c.reason ? [c.reason] : [])))])

function toggle(offset: ReminderOffset) {
  model.value = model.value.includes(offset) ? model.value.filter((o) => o !== offset) : [...model.value, offset]
}
</script>

<template>
  <fieldset class="flex flex-col gap-2 text-sm">
    <legend class="mb-1 font-medium">{{ $t('reminders.title') }}</legend>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="c in choices"
        :key="c.offset"
        type="button"
        :aria-pressed="c.allowed && model.includes(c.offset)"
        :disabled="!c.allowed"
        :class="[
          'rounded-full border px-3 py-1.5 disabled:cursor-not-allowed disabled:border-dashed disabled:opacity-40',
          c.allowed && model.includes(c.offset) ? 'border-accent bg-accent text-on-accent' : 'border-line',
        ]"
        @click="toggle(c.offset)"
      >
        {{ $t(`reminders.offsets.${c.offset}`) }}
      </button>
    </div>
    <p v-for="r in reasons" :key="r" class="text-muted">{{ $t(`reminders.reasons.${r}`) }}</p>
    <p v-if="!picked.length" class="font-medium text-urgent-yellow-text">{{ $t('reminders.noneFit') }}</p>
    <p v-if="dueTime" class="text-muted">
      {{ $t('reminders.dayTimeStart', { time: formatTime(`${dueTime.slice(0, 5)}:00`) }) }}
    </p>
    <p v-else class="text-muted">{{ $t('reminders.dayTime', { time: formatTime(`${dayReminderTime}:00`) }) }}</p>
  </fieldset>
</template>
