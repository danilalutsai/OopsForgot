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
import { useItemActions } from './actions'
import { dueDateOf, handledNow, type Item, questionOf, recurrenceOf, useUpdateItem } from './api'
import QuestionBox from './QuestionBox.vue'
import CategoryChips from './CategoryChips.vue'
import RepeatPicker from './RepeatPicker.vue'
import ToastBar from '../components/ToastBar.vue'
import SheetLine from './SheetLine.vue'
import { INPUT as input } from './ui'
import CountdownText from './CountdownText.vue'

const props = defineProps<{ item: Item | null }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const update = useUpdateItem()
const actions = useItemActions()
const confirmingDelete = ref(false)
const question = computed(() => (props.item ? questionOf(props.item, today.value) : null))
/** Captured when the question opens, so the title stays right while the sheet closes. */
const deletingName = ref('')

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
  price: item.price_cents != null ? (item.price_cents / 100).toFixed(2) : '',
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

// The saved Item can change under the sheet (an answered question, Handled, a refetch). Follow it while
// nothing is being edited, so the sheet never shows stale values or saves them back over the change.
watch(
  () => props.item && toDraft(props.item),
  (fresh) => {
    if (!fresh || !saved.value || dirty.value || sameDraft(fresh, saved.value)) return
    Object.assign(draft, fresh)
    saved.value = fresh
    session.value++
  },
)

/** Two drafts mean the same Item, ignoring spaces around text and how the Recurrence object was built. */
function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.category === b.category &&
    a.due_date === b.due_date &&
    a.due_time === b.due_time &&
    a.recurrence?.unit === b.recurrence?.unit &&
    a.recurrence?.every === b.recurrence?.every &&
    (a.recurrence === undefined) === (b.recurrence === undefined) &&
    a.price.trim() === b.price.trim() &&
    a.notes.trim() === b.notes.trim()
  )
}
const dirty = computed(() => saved.value !== null && !sameDraft(draft, saved.value))
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
  // What is being sent; anything typed while it is in flight stays unsaved.
  const sending: Draft = { ...draft, recurrence: draft.recurrence && { ...draft.recurrence } }
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
    saved.value = sending
    justSaved.value = true
    return true
  } catch {
    errors.value = ['save']
    return false
  }
}

/** Handled / Archive / Delete act on the saved Item straight away; Archive and Delete close the sheet. */
function toggleHandled() {
  if (props.item) void actions.toggleHandled(props.item, dueDateOf(props.item, today.value))
}
function askDelete() {
  deletingName.value = props.item?.name ?? ''
  confirmingDelete.value = true
}
async function archive() {
  if (!props.item) return
  const item = props.item
  emit('close')
  await actions.archive(item)
}
async function remove() {
  if (!props.item) return
  const item = props.item
  emit('close')
  await actions.delete(item)
}

/** A tap outside with unsaved changes asks too, instead of doing nothing. */
function onOutside(e: Event) {
  if (!dirty.value) return
  e.preventDefault()
  requestClose()
}

/** Closing with unsaved changes asks first. */
function requestClose() {
  if (update.isPending.value) return
  if (dirty.value) asking.value = true
  else emit('close')
}
/** Save from the leave question: the question stays open, with the reason, if saving fails. */
async function saveAndClose() {
  if (!(await save())) return
  asking.value = false
  emit('close')
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
  if (close && !dirty.value) {
    gsap.to(panel.value, { y: '100%', duration: duration(0.2), ease: 'power2.out', onComplete: () => emit('close') })
    return
  }
  gsap.to(panel.value, { y: 0, duration: duration(0.2), ease: 'power2.out' })
  if (close) requestClose()
}

const lineText = {
  dueDate: () => (draft.due_date ? formatDate(draft.due_date, today.value) : t('itemSheet.none')),
  time: () => (draft.due_time ? formatTime(draft.due_time) : t('itemSheet.noTime')),
  repeats: () =>
    draft.recurrence === undefined
      ? t('itemSheet.fixRepeat')
      : draft.recurrence
        ? t(`items.repeats.${draft.recurrence.unit}`, { n: draft.recurrence.every }, draft.recurrence.every)
        : t('itemForm.repeatOptions.none'),
  price: () => (priceCents.value != null ? formatMoney(priceCents.value, currency.value) : t('itemSheet.none')),
  category: () => (draft.category ? `${CATEGORY_ICONS[draft.category]} ${t(`categories.${draft.category}`)}` : ''),
  notes: () => draft.notes.trim() || t('itemSheet.addNotes'),
}
</script>

<template>
  <DialogRoot :open="!!item" @update:open="(o) => !o && requestClose()">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-30 bg-black/40" />
      <DialogContent
        ref="panelRef"
        class="fixed inset-x-0 bottom-0 z-40 flex max-h-[92dvh] flex-col rounded-t-3xl bg-surface text-text shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[420px] md:rounded-none"
        @pointer-down-outside="onOutside"
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
          <QuestionBox v-if="question" :item="item" :question="question" :disabled="dirty" @archived="emit('close')" />
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
              <p v-if="left" class="text-sm text-muted"><CountdownText :countdown="left" /></p>
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

          <p v-if="dirty" class="mt-4 px-3 text-sm text-muted">{{ $t('itemSheet.saveFirst') }}</p>
          <div :class="['mt-4 grid gap-2 px-3 pb-4', question ? 'grid-cols-2' : 'grid-cols-3']">
            <!-- no Handled while a question is open: answer it instead -->
            <button
              v-if="!question"
              type="button"
              class="rounded-xl border border-line py-2.5 text-sm font-semibold"
              :aria-pressed="handledNow(item, today)"
              @click="toggleHandled"
            >
              {{ handledNow(item, today) ? $t('itemSheet.undoHandled') : $t('itemSheet.handled') }}
            </button>
            <button
              type="button"
              class="rounded-xl border border-line py-2.5 text-sm font-semibold disabled:opacity-40"
              :disabled="dirty"
              @click="archive"
            >
              {{ $t('itemSheet.archive') }}
            </button>
            <button
              type="button"
              class="rounded-xl border border-line py-2.5 text-sm font-semibold text-urgent-red disabled:opacity-40"
              :disabled="dirty"
              @click="askDelete"
            >
              {{ $t('itemSheet.delete') }}
            </button>
          </div>
        </div>
        <ToastBar in-sheet />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <AlertDialogRoot v-model:open="confirmingDelete">
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-50 bg-black/40" />
      <AlertDialogContent
        class="fixed top-1/2 left-1/2 z-50 w-[min(90vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-5 text-text shadow-2xl"
      >
        <AlertDialogTitle class="text-lg font-semibold">{{
          $t('itemSheet.deleteTitle', { name: deletingName })
        }}</AlertDialogTitle>
        <AlertDialogDescription class="mt-1 text-muted">{{ $t('itemSheet.deleteBody') }}</AlertDialogDescription>
        <div class="mt-5 flex flex-col gap-2">
          <AlertDialogAction class="rounded-xl bg-urgent-red py-2.5 font-semibold text-white" @click="remove">
            {{ $t('itemSheet.deleteConfirm') }}
          </AlertDialogAction>
          <AlertDialogCancel class="rounded-xl py-2.5 font-semibold text-accent">{{
            $t('itemSheet.cancel')
          }}</AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>

  <AlertDialogRoot v-model:open="asking">
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-50 bg-black/40" />
      <AlertDialogContent
        class="fixed top-1/2 left-1/2 z-50 w-[min(90vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-5 text-text shadow-2xl"
      >
        <AlertDialogTitle class="text-lg font-semibold">{{ $t('itemSheet.leaveTitle') }}</AlertDialogTitle>
        <AlertDialogDescription class="mt-1 text-muted">{{ $t('itemSheet.leaveBody') }}</AlertDialogDescription>
        <p v-if="errors.length" role="alert" class="mt-3 text-sm font-medium text-urgent-red">
          <span v-for="e in errors" :key="e" class="block">{{ $t(`itemForm.errors.${e}`) }}</span>
        </p>
        <div class="mt-5 flex flex-col gap-2">
          <!-- a plain button: the question stays open if saving fails -->
          <button
            type="button"
            :disabled="update.isPending.value"
            class="rounded-xl bg-accent py-2.5 font-semibold text-on-accent disabled:opacity-50"
            @click="saveAndClose"
          >
            {{ $t('itemSheet.save') }}
          </button>
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
