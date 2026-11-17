<script setup lang="ts">
import {
  CATEGORY_ICONS,
  type Category,
  countdown,
  looksLikeFullNumber,
  parseAmount,
  type Recurrence,
} from '@oopsproof/shared'
import { gsap } from 'gsap'
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDate, formatMoney, formatTime } from '../format'
import { duration } from '../motion'
import { currency, today } from '../today'
import { dueDateOf, type Item, recurrenceOf, useUpdateItem } from './api'
import CategoryChips from './CategoryChips.vue'
import RepeatPicker from './RepeatPicker.vue'
import SheetLine from './SheetLine.vue'

const props = defineProps<{ item: Item | null }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const update = useUpdateItem()

interface Draft {
  name: string
  category: Category | null
  due_date: string
  due_time: string
  recurrence: Recurrence | null | undefined
  price: string
  notes: string
}

const toDraft = (item: Item): Draft => ({
  name: item.name,
  category: item.category,
  due_date: item.due_date,
  due_time: item.due_time?.slice(0, 5) ?? '',
  recurrence: recurrenceOf(item),
  price: item.price_cents ? (item.price_cents / 100).toFixed(2) : '',
  notes: item.notes,
})

const draft = reactive<Draft>({
  name: '',
  category: null,
  due_date: '',
  due_time: '',
  recurrence: null,
  price: '',
  notes: '',
})
const saved = ref<Draft | null>(null)
const openLine = ref<string | null>(null)
const errors = ref<string[]>([])
const justSaved = ref(false)
const asking = ref(false)
const session = ref(0)

watch(
  () => props.item?.id,
  () => {
    if (!props.item) return
    Object.assign(draft, toDraft(props.item))
    saved.value = toDraft(props.item)
    openLine.value = null
    errors.value = []
    justSaved.value = false
    session.value++
  },
  { immediate: true },
)

const dirty = computed(() => saved.value !== null && JSON.stringify(draft) !== JSON.stringify(saved.value))
const priceCents = computed(() => (draft.price.trim() ? parseAmount(draft.price) : null))
const shownDue = computed(() =>
  props.item && draft.due_date
    ? dueDateOf(
        {
          ...props.item,
          due_date: draft.due_date,
          recurrence_unit: draft.recurrence?.unit ?? null,
          recurrence_every: draft.recurrence?.every ?? null,
        },
        today.value,
      )
    : '',
)
const left = computed(() => (shownDue.value ? countdown(shownDue.value, today.value) : null))

const toggle = (line: string) => (openLine.value = openLine.value === line ? null : line)
const pick = () => (openLine.value = null)

async function save(): Promise<boolean> {
  errors.value = [
    !draft.name.trim() && 'name',
    !draft.due_date && 'dueDate',
    draft.price.trim() && priceCents.value === null && 'price',
    draft.recurrence === undefined && 'every',
  ].filter((e): e is string => !!e)
  if (errors.value.length || !props.item) return false
  try {
    await update.mutateAsync({
      id: props.item.id,
      name: draft.name.trim(),
      category: draft.category!,
      due_date: draft.due_date,
      due_time: draft.due_time || null,
      recurrence_unit: draft.recurrence?.unit ?? null,
      recurrence_every: draft.recurrence?.every ?? null,
      price_cents: priceCents.value,
      notes: draft.notes.trim(),
    })
    draft.name = draft.name.trim()
    draft.notes = draft.notes.trim()
    saved.value = { ...draft }
    justSaved.value = true
    return true
  } catch {
    errors.value = ['save']
    return false
  }
}

/** Closing with unsaved changes asks first. */
function requestClose() {
  if (update.isPending.value) return
  if (dirty.value) asking.value = true
  else emit('close')
}
async function saveAndClose() {
  if (await save()) emit('close')
}
function discard() {
  asking.value = false
  emit('close')
}

// Phone: drag the top bar down to close; past half the sheet or a quick flick closes, otherwise it springs back.
const panelRef = ref<InstanceType<typeof DialogContent>>()
const panel = computed(() => panelRef.value?.$el as HTMLElement | undefined)
let drag: { y: number; t: number } | null = null
function dragStart(e: PointerEvent) {
  // Taps on the bar's buttons stay taps; only the bar itself drags.
  if (window.matchMedia('(min-width: 768px)').matches || (e.target as HTMLElement).closest('button')) return
  drag = { y: e.clientY, t: e.timeStamp }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function dragMove(e: PointerEvent) {
  if (!drag || !panel.value) return
  gsap.set(panel.value, { y: Math.max(0, e.clientY - drag.y) })
}
function dragEnd(e: PointerEvent) {
  if (!drag || !panel.value) return
  const dy = e.clientY - drag.y
  const speed = dy / Math.max(1, e.timeStamp - drag.t)
  drag = null
  const close = dy > panel.value.offsetHeight / 2 || (speed > 0.8 && dy > 60)
  gsap.to(panel.value, { y: 0, duration: duration(0.2), ease: 'power2.out' })
  if (close) requestClose()
}

const lineText = {
  dueDate: () => (draft.due_date ? formatDate(draft.due_date, today.value) : t('itemSheet.none')),
  time: () => (draft.due_time ? formatTime(draft.due_time) : t('itemSheet.noTime')),
  repeats: () =>
    draft.recurrence
      ? t(`items.repeats.${draft.recurrence.unit}`, { n: draft.recurrence.every }, draft.recurrence.every)
      : t('itemForm.repeatOptions.none'),
  price: () => (priceCents.value ? formatMoney(priceCents.value, currency) : t('itemSheet.none')),
  category: () => (draft.category ? `${CATEGORY_ICONS[draft.category]} ${t(`categories.${draft.category}`)}` : ''),
  notes: () => draft.notes.trim() || t('itemSheet.addNotes'),
}
const input = 'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-accent'
</script>

<template>
  <DialogRoot :open="!!item" @update:open="(o) => !o && requestClose()">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-30 bg-black/40" />
      <DialogContent
        ref="panelRef"
        class="fixed inset-x-0 bottom-0 z-40 flex max-h-[92dvh] flex-col rounded-t-3xl bg-surface text-text shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[420px] md:rounded-none"
        @pointer-down-outside="(e) => dirty && e.preventDefault()"
      >
        <header
          class="flex touch-none flex-col border-b border-line px-4 pt-2 pb-3"
          @pointerdown="dragStart"
          @pointermove="dragMove"
          @pointerup="dragEnd"
          @pointercancel="dragEnd"
        >
          <span class="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line md:hidden" aria-hidden="true" />
          <div class="flex items-center gap-2">
            <button type="button" class="text-accent md:hidden" @click="requestClose">
              {{ $t('itemSheet.close') }}
            </button>
            <button
              type="button"
              class="hidden text-xl text-muted md:block"
              :aria-label="$t('itemSheet.close')"
              @click="requestClose"
            >
              ✕
            </button>
            <p class="flex-1 text-center text-sm text-muted" role="status">
              {{ dirty ? $t('itemSheet.unsaved') : justSaved ? $t('itemSheet.saved') : $t('itemSheet.allSaved') }}
            </p>
            <button
              type="button"
              :disabled="!dirty || update.isPending.value"
              class="rounded-full bg-accent px-4 py-1.5 font-semibold text-on-accent disabled:opacity-40"
              @click="save"
            >
              {{ $t('itemSheet.save') }}
            </button>
          </div>
        </header>

        <div v-if="item" class="flex flex-col gap-1 overflow-y-auto p-3">
          <p
            v-if="errors.length"
            role="alert"
            class="mb-2 rounded-xl bg-urgent-red/10 p-3 text-sm font-medium text-urgent-red"
          >
            <span v-for="e in errors" :key="e" class="block">{{ $t(`itemForm.errors.${e}`) }}</span>
          </p>
          <div class="flex items-center gap-3 px-3 pt-1 pb-3">
            <span class="text-3xl" aria-hidden="true">{{ draft.category ? CATEGORY_ICONS[draft.category] : '' }}</span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <DialogTitle class="min-w-0 truncate text-xl font-bold">{{ draft.name || item.name }}</DialogTitle>
                <button
                  type="button"
                  class="shrink-0 rounded-full px-2 text-muted hover:bg-bg"
                  :aria-label="$t('itemSheet.edit', { field: $t('itemForm.name') })"
                  :aria-expanded="openLine === 'name'"
                  @click="toggle('name')"
                >
                  ✎
                </button>
              </div>
              <p v-if="left" class="text-sm text-muted">
                {{
                  left.kind === 'dueToday'
                    ? $t('items.countdown.dueToday')
                    : $t(`items.countdown.${left.kind}`, { days: left.days }, left.days)
                }}
              </p>
            </div>
          </div>
          <div v-if="openLine === 'name'" class="px-3 pb-3">
            <input v-model="draft.name" :aria-label="$t('itemForm.name')" :class="input" />
          </div>

          <SheetLine
            :label="$t('itemForm.dueDate')"
            :value="lineText.dueDate()"
            :open="openLine === 'dueDate'"
            @toggle="toggle('dueDate')"
          >
            <input v-model="draft.due_date" type="date" :aria-label="$t('itemForm.dueDate')" :class="input" />
          </SheetLine>
          <SheetLine
            :label="$t('itemForm.time')"
            :value="lineText.time()"
            :open="openLine === 'time'"
            @toggle="toggle('time')"
          >
            <div class="flex gap-2">
              <input v-model="draft.due_time" type="time" :aria-label="$t('itemForm.time')" :class="input" />
              <button type="button" class="shrink-0 rounded-xl border border-line px-3" @click="draft.due_time = ''">
                {{ $t('itemSheet.noTime') }}
              </button>
            </div>
          </SheetLine>
          <SheetLine
            :label="$t('itemForm.repeats')"
            :value="lineText.repeats()"
            :open="openLine === 'repeats'"
            @toggle="toggle('repeats')"
          >
            <RepeatPicker :key="session" v-model="draft.recurrence" />
          </SheetLine>
          <SheetLine
            :label="$t('itemForm.price')"
            :value="lineText.price()"
            :open="openLine === 'price'"
            @toggle="toggle('price')"
          >
            <input
              v-model="draft.price"
              inputmode="decimal"
              :aria-label="$t('itemForm.price')"
              placeholder="0.00"
              :class="input"
            />
          </SheetLine>
          <SheetLine
            :label="$t('itemForm.category')"
            :value="lineText.category()"
            :open="openLine === 'category'"
            @toggle="toggle('category')"
          >
            <CategoryChips
              v-model="draft.category"
              :legend="$t('itemForm.category')"
              name="sheet-category"
              @update:model-value="pick"
            />
          </SheetLine>
          <SheetLine
            :label="$t('itemForm.notes')"
            :value="lineText.notes()"
            :open="openLine === 'notes'"
            @toggle="toggle('notes')"
          >
            <textarea v-model="draft.notes" rows="4" :aria-label="$t('itemForm.notes')" :class="input" />
            <p v-if="looksLikeFullNumber(draft.notes)" class="mt-1 text-sm font-medium text-urgent-yellow-text">
              {{ $t('itemForm.numberWarning') }}
            </p>
          </SheetLine>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <AlertDialogRoot v-model:open="asking">
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-50 bg-black/40" />
      <AlertDialogContent
        class="fixed top-1/2 left-1/2 z-50 w-[min(90vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-5 text-text shadow-2xl"
      >
        <AlertDialogTitle class="text-lg font-semibold">{{ $t('itemSheet.leaveTitle') }}</AlertDialogTitle>
        <AlertDialogDescription class="mt-1 text-muted">{{ $t('itemSheet.leaveBody') }}</AlertDialogDescription>
        <div class="mt-5 flex flex-col gap-2">
          <AlertDialogAction class="rounded-xl bg-accent py-2.5 font-semibold text-on-accent" @click="saveAndClose">
            {{ $t('itemSheet.save') }}
          </AlertDialogAction>
          <AlertDialogAction
            class="rounded-xl border border-line py-2.5 font-semibold text-urgent-red"
            @click="discard"
          >
            {{ $t('itemSheet.discard') }}
          </AlertDialogAction>
          <AlertDialogCancel class="rounded-xl py-2.5 font-semibold text-accent">{{
            $t('itemSheet.keepEditing')
          }}</AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
