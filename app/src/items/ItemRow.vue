<script setup lang="ts">
import { CATEGORY_ICONS, countdown, urgency } from '@oopsproof/shared'
import { computed } from 'vue'
import { formatDate, formatMoney, formatTime } from '../format'
import { currency, today } from '../today'
import { dueDateOf, type Item } from './api'

const props = defineProps<{ item: Item }>()

const due = computed(() => dueDateOf(props.item, today.value))
const level = computed(() => urgency({ dueDate: due.value, handled: false }, today.value))
const left = computed(() => countdown(due.value, today.value))
const barColor = { red: 'bg-urgent-red', yellow: 'bg-urgent-yellow', green: 'bg-urgent-green', grey: 'bg-urgent-grey' }
const textColor = {
  red: 'text-urgent-red',
  yellow: 'text-urgent-yellow-text',
  green: 'text-urgent-green-text',
  grey: 'text-muted',
}
</script>

<template>
  <li class="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
    <span :class="['h-10 w-1 shrink-0 rounded-full', barColor[level]]" aria-hidden="true" />
    <span class="text-xl" aria-hidden="true">{{ CATEGORY_ICONS[item.category] }}</span>
    <div class="min-w-0 flex-1">
      <p class="truncate font-semibold">{{ item.name }}</p>
      <p class="flex flex-wrap gap-x-2 text-[13px]">
        <span :class="['font-semibold', textColor[level]]">
          {{
            left.kind === 'dueToday'
              ? $t('items.countdown.dueToday')
              : $t(`items.countdown.${left.kind}`, { days: left.days }, left.days)
          }}
        </span>
        <span class="text-muted">
          {{ formatDate(due, today) }}<template v-if="item.due_time"> · {{ formatTime(item.due_time) }}</template
          ><template v-if="item.price_cents"> · {{ formatMoney(item.price_cents, currency) }}</template
          ><template v-if="item.recurrence_unit && item.recurrence_every">
            ·
            {{
              $t(`items.repeats.${item.recurrence_unit}`, { n: item.recurrence_every }, item.recurrence_every)
            }}</template
          >
        </span>
      </p>
    </div>
  </li>
</template>
