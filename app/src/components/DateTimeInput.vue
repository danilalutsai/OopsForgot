<script setup lang="ts">
import { type DateValue, parseDate } from '@internationalized/date'
import { Calendar, ChevronLeft, ChevronRight, Clock } from '@lucide/vue'
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeader,
  CalendarHeading,
  CalendarNext,
  CalendarPrev,
  CalendarRoot,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import { computed, nextTick, ref, shallowRef, useAttrs, watch } from 'vue'
import { formatTime } from '../format'
import { INPUT } from '../items/ui'
import { today } from '../today'
import { firstDayOfWeek } from '../weekStart'

/**
 * A date ("YYYY-MM-DD") or time ("HH:MM", 24-hour) field with the app's own picker instead of the
 * browser's: a month calendar for dates, hour and minute columns for times. Empty, it shows a muted
 * placeholder. Give it an aria-label: the field's name, which the button is read with.
 * A class sizes the field (it goes on the wrapper); aria-label, aria-describedby and disabled go to
 * the button. `min` and `max` limit dates; `step` (seconds, like an input's) sets the minute steps.
 * A time is saved once it is whole: when the minutes are picked or the picker closes.
 */
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    type: 'date' | 'time'
    placeholder: string
    min?: string
    max?: string
    step?: number
    clearable?: boolean
  }>(),
  { min: undefined, max: undefined, step: 300, clearable: true },
)
const value = defineModel<string>({ default: '' })
const attrs = useAttrs()
/** The field's name; the button is read as the name and what it shows ("Event date, Choose a date"). */
const label = computed(() => attrs['aria-label'] as string | undefined)
const buttonAttrs = computed(() => ({ ...attrs, class: undefined, 'aria-label': undefined }))
const open = ref(false)
const language = () => navigator.language

/** "Tue, 24 Nov 2026" in the browser's own format; times are always 24-hour. */
const shown = computed(() => {
  if (!value.value) return ''
  if (props.type === 'time') return formatTime(`${value.value}:00`)
  return new Date(`${value.value}T12:00:00Z`).toLocaleDateString(language(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
})

// ---- dates

const parse = (date?: string) => (date ? parseDate(date) : undefined)
const picked = computed(() => parse(value.value))
/** The month on show: the picked date's, else this month's (kept within min and max). */
const month = shallowRef<DateValue>(parseDate(today.value))
const weekStartsOn = computed(() => (firstDayOfWeek(language()) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6)
const todayAllowed = computed(
  () => (!props.min || today.value >= props.min) && (!props.max || today.value <= props.max),
)

function pickDate(date: DateValue | undefined) {
  if (!date) return
  value.value = date.toString()
  open.value = false
}

// ---- times

const pad = (n: number) => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, h) => pad(h))
/** The time being picked, saved into the value when the minutes are picked or the picker closes. */
const draft = ref('')
const hour = computed(() => draft.value.slice(0, 2))
const minute = computed(() => draft.value.slice(3, 5))
/** Minutes in steps; a stored time between the steps still shows as picked. */
const minutes = computed(() => {
  const every = Math.max(1, Math.round(props.step / 60))
  const list = Array.from({ length: Math.ceil(60 / every) }, (_, i) => pad(i * every))
  if (minute.value && !list.includes(minute.value)) list.push(minute.value)
  return list.sort()
})

/** Picking the hour keeps the minutes (":00" when there were none); picking the minutes closes. */
function pickHour(h: string) {
  draft.value = `${h}:${minute.value || '00'}`
}
function pickMinute(m: string) {
  draft.value = `${hour.value || '12'}:${m}`
  open.value = false
}

const columns = ref<HTMLElement[]>([])
watch(open, async (isOpen) => {
  if (props.type === 'time') {
    if (isOpen) draft.value = value.value
    else if (draft.value !== value.value) value.value = draft.value
  }
  if (!isOpen) return
  if (props.type === 'date') {
    const start =
      picked.value ?? parse(todayAllowed.value ? today.value : (props.max ?? props.min)) ?? parse(today.value)!
    month.value = start
    return
  }
  // the picked hour and minute start in view
  await nextTick()
  for (const column of columns.value) {
    column.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
  }
})

function clear() {
  draft.value = value.value = ''
  open.value = false
}

const CELL =
  'flex h-9 w-9 items-center justify-center rounded-full text-sm outline-none hover:bg-bg focus-visible:ring-2 focus-visible:ring-accent ' +
  'data-[today]:font-bold data-[today]:text-accent data-[outside-view]:text-muted ' +
  'data-[selected]:bg-accent data-[selected]:font-semibold data-[selected]:text-on-accent data-[selected]:hover:bg-accent ' +
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-30'
const OPTION =
  'w-full rounded-lg py-1.5 text-center text-sm tabular-nums outline-none hover:bg-bg focus-visible:ring-2 focus-visible:ring-accent ' +
  'aria-selected:bg-accent aria-selected:font-semibold aria-selected:text-on-accent aria-selected:hover:bg-accent'
const FOOTER_BUTTON = 'rounded-lg px-2 py-1.5 text-sm font-semibold text-accent hover:bg-bg disabled:opacity-40'
</script>

<template>
  <PopoverRoot v-model:open="open">
    <span :class="['block min-w-0', attrs.class]">
      <PopoverTrigger
        v-bind="buttonAttrs"
        :aria-label="label && `${label}, ${shown || placeholder}`"
        :data-label="label"
        :data-kind="type"
        :data-value="value"
        :class="[INPUT, 'flex min-h-[2.875rem] items-center justify-between gap-2 text-left', open && 'border-accent']"
      >
        <span :class="['truncate', !value && 'text-muted']">{{ shown || placeholder }}</span>
        <component :is="type === 'date' ? Calendar : Clock" :size="18" class="shrink-0 text-muted" aria-hidden="true" />
      </PopoverTrigger>
    </span>
    <PopoverPortal>
      <PopoverContent
        align="start"
        :side-offset="6"
        :collision-padding="12"
        class="z-50 rounded-2xl border border-line bg-raised p-3 text-text shadow-xl outline-none"
      >
        <CalendarRoot
          v-if="type === 'date'"
          v-slot="{ grid, weekDays }"
          v-model:placeholder="month"
          :model-value="picked"
          :min-value="parse(min)"
          :max-value="parse(max)"
          :week-starts-on="weekStartsOn"
          :locale="language()"
          weekday-format="short"
          fixed-weeks
          @update:model-value="pickDate"
        >
          <CalendarHeader class="mb-2 flex items-center justify-between gap-2">
            <CalendarPrev
              :aria-label="$t('picker.previousMonth')"
              class="flex h-9 w-9 items-center justify-center rounded-full hover:bg-bg disabled:opacity-30"
            >
              <ChevronLeft :size="18" aria-hidden="true" />
            </CalendarPrev>
            <CalendarHeading class="text-sm font-semibold" />
            <CalendarNext
              :aria-label="$t('picker.nextMonth')"
              class="flex h-9 w-9 items-center justify-center rounded-full hover:bg-bg disabled:opacity-30"
            >
              <ChevronRight :size="18" aria-hidden="true" />
            </CalendarNext>
          </CalendarHeader>
          <CalendarGrid v-for="m in grid" :key="m.value.toString()" class="border-collapse">
            <CalendarGridHead>
              <CalendarGridRow class="grid grid-cols-7">
                <CalendarHeadCell
                  v-for="day in weekDays"
                  :key="day"
                  class="flex h-8 w-9 items-center justify-center text-xs font-medium text-muted"
                >
                  {{ day.slice(0, 2) }}
                </CalendarHeadCell>
              </CalendarGridRow>
            </CalendarGridHead>
            <CalendarGridBody>
              <CalendarGridRow v-for="(week, i) in m.rows" :key="i" class="grid grid-cols-7">
                <CalendarCell v-for="day in week" :key="day.toString()" :date="day">
                  <CalendarCellTrigger :day="day" :month="m.value" :class="CELL" />
                </CalendarCell>
              </CalendarGridRow>
            </CalendarGridBody>
          </CalendarGrid>
          <div class="mt-2 flex justify-between border-t border-line pt-2">
            <button v-if="clearable" type="button" :class="FOOTER_BUTTON" :disabled="!value" @click="clear">
              {{ $t('picker.clear') }}
            </button>
            <button type="button" :class="FOOTER_BUTTON" :disabled="!todayAllowed" @click="pickDate(parse(today))">
              {{ $t('picker.today') }}
            </button>
          </div>
        </CalendarRoot>

        <div v-else class="w-44">
          <div class="flex gap-2">
            <div
              v-for="column in ['hours', 'minutes'] as const"
              :key="column"
              ref="columns"
              role="listbox"
              :aria-label="$t(`picker.${column}`)"
              class="flex h-56 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain pr-0.5"
            >
              <template v-if="column === 'hours'">
                <button
                  v-for="h in HOURS"
                  :key="h"
                  type="button"
                  role="option"
                  :aria-selected="h === hour"
                  :class="OPTION"
                  @click="pickHour(h)"
                >
                  {{ h }}
                </button>
              </template>
              <template v-else>
                <button
                  v-for="m in minutes"
                  :key="m"
                  type="button"
                  role="option"
                  :aria-selected="m === minute"
                  :class="OPTION"
                  @click="pickMinute(m)"
                >
                  {{ m }}
                </button>
              </template>
            </div>
          </div>
          <div class="mt-2 flex justify-between border-t border-line pt-2">
            <button v-if="clearable" type="button" :class="FOOTER_BUTTON" :disabled="!value" @click="clear">
              {{ $t('picker.clear') }}
            </button>
            <button type="button" :class="FOOTER_BUTTON" @click="open = false">{{ $t('picker.done') }}</button>
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
