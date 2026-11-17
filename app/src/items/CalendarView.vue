<script setup lang="ts">
import { addDays, addMonths, calendarDays, dueDatesBetween, urgency } from '@oopsproof/shared'
import { computed, ref } from 'vue'
import { fadeTransition } from '../motion'
import { today } from '../today'
import { useItemActions } from './actions'
import { type Item, questionOf, recurrenceOf } from './api'
import ItemRow from './ItemRow.vue'

const props = defineProps<{ items: Item[] }>()
defineEmits<{ open: [id: string] }>()
const actions = useItemActions()

const view = ref<'week' | 'month'>('month')
const anchor = ref(today.value)
const selected = ref(today.value)

/** The weekday weeks start on in the person's locale (1 = Monday … 7 = Sunday). */
const firstDay = (() => {
  const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number }
    weekInfo?: { firstDay: number }
  }
  return locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay ?? 1
})()

const days = computed(() => calendarDays(view.value, anchor.value, firstDay))

/** Every Due date shown, with the Items due on it. */
const byDay = computed(() => {
  const map = new Map<string, Item[]>()
  const from = days.value[0]!
  const to = days.value.at(-1)!
  for (const item of props.items) {
    for (const d of dueDatesBetween({ dueDate: item.due_date, recurrence: recurrenceOf(item) }, from, to)) {
      map.set(d, [...(map.get(d) ?? []), item])
    }
  }
  return map
})

const level = (item: Item, day: string) =>
  urgency({ dueDate: day, handled: item.handled_due_date === day }, today.value)
const dotColor = { red: 'bg-urgent-red', yellow: 'bg-urgent-yellow', green: 'bg-urgent-green', grey: 'bg-urgent-grey' }

const locale = () => navigator.language
const label = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(locale(), { timeZone: 'UTC', ...opts })
const title = computed(() =>
  view.value === 'month'
    ? label(anchor.value, { month: 'long', year: 'numeric' })
    : `${label(days.value[0]!, { day: 'numeric', month: 'short' })} – ${label(days.value[6]!, { day: 'numeric', month: 'short', year: 'numeric' })}`,
)
const weekdays = computed(() => days.value.slice(0, 7).map((d) => label(d, { weekday: 'short' })))

function move(step: number) {
  anchor.value =
    view.value === 'week' ? addDays(anchor.value, 7 * step) : addMonths(`${anchor.value.slice(0, 7)}-01`, step)
}
function goToday() {
  anchor.value = selected.value = today.value
}

const selectedItems = computed(() => byDay.value.get(selected.value) ?? [])
</script>

<template>
  <div class="px-4">
    <div class="flex items-center gap-2 py-2">
      <button type="button" class="rounded-full px-2 text-xl" :aria-label="$t('calendar.previous')" @click="move(-1)">
        ‹
      </button>
      <h2 class="flex-1 text-center font-semibold" aria-live="polite">{{ title }}</h2>
      <button type="button" class="rounded-full px-2 text-xl" :aria-label="$t('calendar.next')" @click="move(1)">
        ›
      </button>
    </div>
    <div class="mb-2 flex items-center justify-between text-sm">
      <div class="grid grid-cols-2 rounded-lg border border-line p-0.5" role="group">
        <button
          v-for="v in ['week', 'month'] as const"
          :key="v"
          type="button"
          :aria-pressed="view === v"
          :class="['rounded-md px-3 py-1', view === v ? 'bg-accent font-semibold text-on-accent' : 'text-muted']"
          @click="view = v"
        >
          {{ $t(`calendar.${v}`) }}
        </button>
      </div>
      <button type="button" class="font-semibold text-accent" @click="goToday">{{ $t('calendar.today') }}</button>
    </div>

    <Transition mode="out-in" :css="false" @enter="fadeTransition.onEnter" @leave="fadeTransition.onLeave">
      <div :key="`${view}-${days[0]}`" class="grid grid-cols-7 gap-1 text-center text-sm">
        <span v-for="w in weekdays" :key="w" class="py-1 text-xs text-muted" aria-hidden="true">{{ w }}</span>
        <button
          v-for="day in days"
          :key="day"
          type="button"
          :aria-pressed="selected === day"
          :aria-label="
            (byDay.get(day)?.length ?? 0)
              ? $t(
                  'calendar.day',
                  { date: label(day, { day: 'numeric', month: 'long' }), n: byDay.get(day)!.length },
                  byDay.get(day)!.length,
                )
              : $t('calendar.dayEmpty', { date: label(day, { day: 'numeric', month: 'long' }) })
          "
          :class="[
            'flex h-12 flex-col items-center justify-start rounded-lg pt-1',
            selected === day ? 'bg-accent/15 ring-2 ring-accent' : 'hover:bg-bg',
            view === 'month' && day.slice(0, 7) !== anchor.slice(0, 7) && 'text-muted',
            day === today && 'font-bold text-accent',
          ]"
          @click="selected = day"
        >
          {{ Number(day.slice(8)) }}
          <span class="mt-1 flex gap-0.5" aria-hidden="true">
            <span
              v-for="item in (byDay.get(day) ?? []).slice(0, 3)"
              :key="item.id"
              :class="['h-1.5 w-1.5 rounded-full', dotColor[level(item, day)]]"
            />
            <span v-if="(byDay.get(day)?.length ?? 0) > 3" class="-mt-1 text-[9px] leading-none text-muted">
              {{ $t('calendar.more', { n: byDay.get(day)!.length - 3 }) }}
            </span>
          </span>
        </button>
      </div>
    </Transition>
  </div>

  <section class="mt-4" :aria-label="label(selected, { weekday: 'long', day: 'numeric', month: 'long' })">
    <h2 class="px-4 pb-1 text-[13px] font-semibold tracking-wide text-muted uppercase">
      {{ label(selected, { weekday: 'long', day: 'numeric', month: 'long' }) }}
    </h2>
    <p v-if="!selectedItems.length" class="px-4 py-3 text-muted">
      {{ $t('calendar.nothingDue', { date: label(selected, { day: 'numeric', month: 'long' }) }) }}
    </p>
    <ul>
      <ItemRow
        v-for="item in selectedItems"
        :key="item.id"
        :item="item"
        :due="selected"
        :handled="item.handled_due_date === selected"
        :question="questionOf(item, today, selected)"
        :archive="() => actions.archive(item)"
        @open="$emit('open', item.id)"
        @toggle-handled="actions.toggleHandled(item, selected)"
      />
    </ul>
  </section>
</template>
