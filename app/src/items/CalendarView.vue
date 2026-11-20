<script setup lang="ts">
import { addDays, addMonths, calendarDays, dueDatesBetween, urgency } from '@oopsforgot/shared'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { gsap } from 'gsap'
import { duration, fadeTransition } from '../motion'
import { today } from '../today'
import { firstDayOfWeek } from '../weekStart'
import { useItemActions } from './actions'
import { dueDateOf, type Item, questionOf, recurrenceOf } from './api'
import ItemRow from './ItemRow.vue'
import { usePeriodSwipe } from './periodSwipe'
import { URGENCY_BG } from './urgencyClasses'
import { ChevronLeft, ChevronRight } from '@lucide/vue'

const props = defineProps<{ items: Item[] }>()
defineEmits<{ open: [id: string] }>()
const actions = useItemActions()
const { t } = useI18n()

const view = ref<'week' | 'month'>('month')
const anchor = ref(today.value)
const selected = ref(today.value)

// Follow "today" when it changes (midnight, or the saved time zone arriving) if the person was looking at it.
watch(today, (now, before) => {
  if (selected.value === before) selected.value = now
  if (anchor.value === before) anchor.value = now
})

const days = computed(() => calendarDays(view.value, anchor.value, firstDayOfWeek()))

/** Where each Item is now: past repeats are gone, so the calendar shows only this Due date and later ones. */
const current = computed(() => new Map(props.items.map((item) => [item.id, dueDateOf(item, today.value)])))

/** Items due on each day in view. */
const byDay = computed(() => {
  const map = new Map<string, Item[]>()
  const first = days.value[0]!
  const last = days.value.at(-1)!
  for (const item of props.items) {
    const now = current.value.get(item.id)!
    const from = item.recurrence_unit && now > first ? now : first
    for (const d of dueDatesBetween({ dueDate: item.due_date, recurrence: recurrenceOf(item) }, from, last)) {
      const list = map.get(d)
      if (list) list.push(item)
      else map.set(d, [item])
    }
  }
  return map
})

const formats = {
  day: new Intl.DateTimeFormat(navigator.language, { timeZone: 'UTC', day: 'numeric', month: 'long' }),
  long: new Intl.DateTimeFormat(navigator.language, {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }),
  weekday: new Intl.DateTimeFormat(navigator.language, { timeZone: 'UTC', weekday: 'short' }),
  month: new Intl.DateTimeFormat(navigator.language, { timeZone: 'UTC', month: 'long', year: 'numeric' }),
  short: new Intl.DateTimeFormat(navigator.language, { timeZone: 'UTC', day: 'numeric', month: 'short' }),
  shortYear: new Intl.DateTimeFormat(navigator.language, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }),
}
const fmt = (f: Intl.DateTimeFormat, day: string) => f.format(new Date(`${day}T12:00:00Z`))

/** Everything a day cell needs, worked out once per render. */
const cells = computed(() =>
  days.value.map((day) => {
    const items = byDay.value.get(day) ?? []
    const date = fmt(formats.day, day)
    return {
      day,
      number: Number(day.slice(8)),
      items,
      dots: items.slice(0, 3).map((item) => ({
        id: item.id,
        color: URGENCY_BG[urgency({ dueDate: day, handled: item.handled_due_date === day }, today.value)],
      })),
      more: Math.max(0, items.length - 3),
      label: items.length
        ? t('calendar.day', { date, n: items.length }, items.length)
        : t('calendar.dayEmpty', { date }),
      outside: view.value === 'month' && day.slice(0, 7) !== anchor.value.slice(0, 7),
    }
  }),
)

const title = computed(() =>
  view.value === 'month'
    ? fmt(formats.month, anchor.value)
    : `${fmt(formats.short, days.value[0]!)} – ${fmt(formats.shortYear, days.value[6]!)}`,
)
const weekdays = computed(() => days.value.slice(0, 7).map((d) => fmt(formats.weekday, d)))

function move(step: number) {
  anchor.value =
    view.value === 'week' ? addDays(anchor.value, 7 * step) : addMonths(`${anchor.value.slice(0, 7)}-01`, step)
}
const swipe = usePeriodSwipe(move)
/** Switching between Week and Month keeps the selected day in view. */
function setView(next: 'week' | 'month') {
  swipe.direction.value = 0
  view.value = next
  anchor.value = selected.value
}
function goToday() {
  swipe.direction.value = 0
  anchor.value = selected.value = today.value
}

/** A new period slides in from the side it was swiped (or stepped) towards; other changes fade. */
const periodTransition = {
  onLeave(el: Element, done: () => void) {
    const step = swipe.direction.value
    if (!step) return fadeTransition.onLeave(el, done)
    const width = (el as HTMLElement).offsetWidth
    gsap.fromTo(
      el,
      { x: swipe.takeOffset() },
      { x: -step * width, opacity: 0, duration: duration(0.18), ease: 'power2.in', onComplete: done },
    )
  },
  onEnter(el: Element, done: () => void) {
    const step = swipe.direction.value
    if (!step) return fadeTransition.onEnter(el, done)
    const width = (el as HTMLElement).offsetWidth
    gsap.fromTo(
      el,
      { x: (step * width) / 2, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: duration(0.2),
        ease: 'power2.out',
        clearProps: 'transform,opacity',
        onComplete: () => {
          swipe.direction.value = 0
          done()
        },
      },
    )
  },
}

const selectedItems = computed(() => byDay.value.get(selected.value) ?? [])
const selectedLabel = computed(() => fmt(formats.long, selected.value))
</script>

<template>
  <div class="px-4">
    <div class="flex items-center gap-2 py-2">
      <button
        type="button"
        class="rounded-full px-2 text-xl"
        :aria-label="$t('calendar.previous')"
        @click="swipe.go(-1)"
      >
        <ChevronLeft :size="22" aria-hidden="true" />
      </button>
      <h2 class="flex-1 text-center font-semibold" aria-live="polite">{{ title }}</h2>
      <button type="button" class="rounded-full px-2 text-xl" :aria-label="$t('calendar.next')" @click="swipe.go(1)">
        <ChevronRight :size="22" aria-hidden="true" />
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
          @click="setView(v)"
        >
          {{ $t(`calendar.${v}`) }}
        </button>
      </div>
      <button type="button" class="font-semibold text-accent" @click="goToday">{{ $t('calendar.today') }}</button>
    </div>

    <!-- swipe sideways for the next or previous period; up and down still scroll the page -->
    <div class="overflow-hidden">
      <div data-testid="calendar-days" class="touch-pan-y select-none" v-bind="swipe.bind" @wheel="swipe.onWheel">
        <Transition mode="out-in" :css="false" @enter="periodTransition.onEnter" @leave="periodTransition.onLeave">
          <div :key="`${view}-${days[0]}`" class="grid grid-cols-7 gap-1 text-center text-sm">
            <span v-for="w in weekdays" :key="w" class="py-1 text-xs text-muted" aria-hidden="true">{{ w }}</span>
            <button
              v-for="cell in cells"
              :key="cell.day"
              type="button"
              :aria-pressed="selected === cell.day"
              :aria-label="cell.label"
              :class="[
                'flex h-12 flex-col items-center justify-start rounded-lg pt-1',
                selected === cell.day ? 'bg-accent/15 ring-2 ring-accent' : 'hover:bg-bg',
                cell.outside && 'text-muted',
                cell.day === today && 'font-bold text-accent',
              ]"
              @click="selected = cell.day"
            >
              {{ cell.number }}
              <span class="mt-1 flex gap-0.5" aria-hidden="true">
                <span v-for="dot in cell.dots" :key="dot.id" :class="['h-1.5 w-1.5 rounded-full', dot.color]" />
                <span v-if="cell.more" class="-mt-1 text-[9px] leading-none text-muted">
                  {{ $t('calendar.more', { n: cell.more }) }}
                </span>
              </span>
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </div>

  <section class="mt-4" :aria-label="selectedLabel">
    <h2 class="px-4 pb-1 text-[13px] font-semibold tracking-wide text-muted uppercase">{{ selectedLabel }}</h2>
    <p v-if="!selectedItems.length" class="px-4 py-3 text-muted">
      {{ $t('calendar.nothingDue', { date: fmt(formats.day, selected) }) }}
    </p>
    <ul>
      <ItemRow
        v-for="item in selectedItems"
        :key="item.id"
        :item="item"
        :due="selected"
        :handled="item.handled_due_date === selected"
        :question="questionOf(item, today, selected)"
        :can-handle="current.get(item.id) === selected"
        :archive="() => actions.archive(item)"
        @open="$emit('open', item.id)"
        @toggle-handled="actions.toggleHandled(item, selected)"
      />
    </ul>
  </section>
</template>
