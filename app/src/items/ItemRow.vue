<script setup lang="ts">
import { countdown, type OpenQuestion, urgency } from '@oopsforgot/shared'
import { Check } from '@lucide/vue'
import { gsap } from 'gsap'
import CategoryIcon from '../components/CategoryIcon.vue'
import { computed, ref } from 'vue'
import { formatDate, formatMoney, formatTimes } from '../format'
import { duration } from '../motion'
import { currency, today } from '../today'
import { type Item, recurrenceOf } from './api'
import CountdownText from './CountdownText.vue'
import { URGENCY_BG } from './urgencyClasses'

const emit = defineEmits<{ open: []; toggleHandled: [] }>()
const props = withDefaults(
  defineProps<{
    item: Item
    /** the Due date the Item is on today */
    due: string
    handled: boolean
    /** a question waiting for an answer; the row shows it instead of the Handled button */
    question: OpenQuestion | null
    /** false for a Due date other than the one the Item is on now: Handled applies only to that one */
    canHandle?: boolean
    /** Expired (one-time, past its Due date or Finish time): the row turns grey */
    expired?: boolean
    /** Deletes the Item; resolves false when that failed, so the row slides back. */
    remove: () => Promise<boolean>
  }>(),
  { canHandle: true, expired: false },
)

const repeats = computed(() => recurrenceOf(props.item))
const level = computed(() =>
  props.expired ? 'grey' : urgency({ dueDate: props.due, handled: props.handled }, today.value),
)
const left = computed(() => countdown(props.due, today.value))
const textColor = {
  red: 'text-urgent-red',
  yellow: 'text-urgent-yellow-text',
  green: 'text-urgent-green-text',
  grey: 'text-muted',
}

// Swipe right = Handled (or Undo), swipe left = Delete (with Undo); a short swipe springs back.
const SWIPE = 80
const slider = ref<HTMLElement>()
let start: { x: number; y: number } | null = null
let swiping = false
/** Which way the row is being swiped, so what the swipe does shows underneath it. */
const showing = ref<'handled' | 'delete' | null>(null)
const canSwipeHandled = computed(() => !props.question && props.canHandle)
/** Back in place: nothing underneath shows any more. */
const springBack = (el: HTMLElement) =>
  gsap.to(el, { x: 0, duration: duration(0.2), ease: 'power2.out', onComplete: () => (showing.value = null) })
function down(e: PointerEvent) {
  start = { x: e.clientX, y: e.clientY }
  swiping = false
}
function move(e: PointerEvent) {
  if (!start || !slider.value) return
  const dx = e.clientX - start.x
  if (!swiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
    swiping = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  if (!swiping) return
  // right only does something when Handled can be marked here
  const x = dx > 0 && !canSwipeHandled.value ? 0 : dx
  showing.value = x > 0 ? 'handled' : x < 0 ? 'delete' : null
  gsap.set(slider.value, { x })
}
function up(e: PointerEvent) {
  if (!start || !slider.value) return
  const dx = e.clientX - start.x
  start = null
  if (!swiping) return
  if (dx < -SWIPE) {
    const el = slider.value
    gsap.to(el, {
      x: '-100%',
      duration: duration(0.2),
      ease: 'power2.out',
      onComplete: async () => {
        if (!(await props.remove())) springBack(el)
      },
    })
    return
  }
  springBack(slider.value)
  if (dx > SWIPE && canSwipeHandled.value) emit('toggleHandled')
}
/** A gesture the browser cancelled never deletes or marks Handled: it just springs back. */
function cancel() {
  start = null
  if (slider.value) springBack(slider.value)
}

/** A swipe must not also count as a tap that opens the Item. */
function click(e: MouseEvent) {
  if (swiping) {
    e.stopPropagation()
    e.preventDefault()
    swiping = false
  }
}
</script>

<template>
  <li class="relative overflow-hidden border-b border-line bg-surface">
    <!-- under the row: what letting go will do -->
    <div
      v-if="showing"
      :class="[
        'absolute inset-0 flex items-center px-5 text-sm font-semibold text-white',
        showing === 'handled' ? 'justify-start bg-emerald-700' : 'justify-end bg-urgent-red',
      ]"
      aria-hidden="true"
    >
      <template v-if="showing === 'handled'"
        ><Check :size="16" :stroke-width="2.5" class="mr-1" />{{
          handled ? $t('swipe.undo') : $t('swipe.handled')
        }}</template
      >
      <template v-else>{{ $t('swipe.delete') }}</template>
    </div>
    <div
      ref="slider"
      class="relative flex touch-pan-y items-center bg-surface"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="cancel"
      @click.capture="click"
    >
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left hover:bg-bg"
        @click="$emit('open')"
      >
        <span
          data-testid="urgency-bar"
          :class="['h-10 w-1 shrink-0 rounded-full', URGENCY_BG[level]]"
          aria-hidden="true"
        />
        <CategoryIcon :category="item.category" :size="22" class="text-muted" />
        <div class="min-w-0 flex-1">
          <p :class="['truncate font-semibold', handled && 'text-muted line-through']">{{ item.name }}</p>
          <p class="flex flex-wrap gap-x-2 text-[13px]">
            <span :class="['font-semibold', textColor[level]]">
              <template v-if="handled">{{ $t('items.handled') }}</template>
              <!-- Expired today, after its Finish time -->
              <template v-else-if="expired && left.kind === 'dueToday'">{{ $t('items.expiredToday') }}</template>
              <CountdownText v-else :countdown="left" />
            </span>
            <span class="text-muted">
              {{ formatDate(due, today)
              }}<template v-if="item.due_time"> · {{ formatTimes(item.due_time, item.finish_time) }}</template
              ><template v-if="item.price_cents"> · {{ formatMoney(item.price_cents, currency) }}</template
              ><template v-if="repeats">
                · {{ $t(`items.repeats.${repeats.unit}`, { n: repeats.every }, repeats.every) }}</template
              >
            </span>
          </p>
        </div>
      </button>
      <button
        v-if="question"
        type="button"
        :class="[
          'mx-3 shrink-0 rounded-full px-3 py-1.5 text-xs font-bold',
          // in grey Expired rows the question stays neutral too
          expired ? 'border border-line text-text' : 'bg-urgent-red text-on-accent',
        ]"
        @click="$emit('open')"
      >
        {{ question === 'expired' ? $t('questions.whatNow') : $t('questions.keptIt') }}
      </button>
      <button
        v-else-if="canHandle"
        type="button"
        :class="[
          'mx-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm',
          handled ? 'bg-urgent-green text-on-accent' : 'border-2 border-line text-muted hover:border-urgent-green',
        ]"
        :aria-pressed="handled"
        :aria-label="
          handled ? $t('items.undoHandled', { name: item.name }) : $t('items.markHandled', { name: item.name })
        "
        @click="$emit('toggleHandled')"
      >
        <Check :size="16" :stroke-width="2.5" aria-hidden="true" />
      </button>
    </div>
  </li>
</template>
