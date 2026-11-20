<script setup lang="ts">
import {
  type Category,
  DEFAULT_REMINDERS,
  looksLikeFullNumber,
  parseAmount,
  type Recurrence,
  type ReminderOffset,
} from '@oopsforgot/shared'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { blockedOffline } from '../online'
import { useAddItem } from './api'
import ToastBar from '../components/ToastBar.vue'
import CategoryChips from './CategoryChips.vue'
import { fittingReminders } from './reminderFit'
import ReminderChips from './ReminderChips.vue'
import RepeatPicker from './RepeatPicker.vue'
import { INPUT as input } from './ui'
import DateTimeInput from '../components/DateTimeInput.vue'

const open = defineModel<boolean>('open', { required: true })
/** A Due date to start with, as when adding from a calendar day. */
const props = defineProps<{ date?: string }>()
const emit = defineEmits<{ saved: [] }>()

const name = ref('')
const category = ref<Category | null>(null)
const dueDate = ref('')
const dueTime = ref('')
const recurrence = ref<Recurrence | null | undefined>(null)
const price = ref('')
const notes = ref('')
const reminders = ref<ReminderOffset[]>([...DEFAULT_REMINDERS])
const errors = ref<string[]>([])
const session = ref(0)
const add = useAddItem()
const numberWarning = computed(() => looksLikeFullNumber(notes.value))

/** The sheet stays open while a save is in flight, so it can't close a newer sheet when it finishes. */
function setOpen(next: boolean) {
  if (!next && add.isPending.value) return
  open.value = next
}

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = dueTime.value = price.value = notes.value = ''
  dueDate.value = props.date ?? ''
  category.value = null
  recurrence.value = null
  reminders.value = [...DEFAULT_REMINDERS]
  errors.value = []
  session.value++
})

async function save() {
  if (blockedOffline()) return
  const priceCents = price.value.trim() ? parseAmount(price.value) : null
  errors.value = [
    !name.value.trim() && 'name',
    !category.value && 'category',
    !dueDate.value && 'dueDate',
    price.value.trim() && priceCents === null && 'price',
    recurrence.value === undefined && 'every',
  ].filter((e): e is string => !!e)
  if (errors.value.length) return
  try {
    await add.mutateAsync({
      name: name.value.trim(),
      category: category.value!,
      due_date: dueDate.value,
      due_time: dueTime.value || null,
      price_cents: priceCents,
      notes: notes.value.trim(),
      recurrence_unit: recurrence.value?.unit ?? null,
      recurrence_every: recurrence.value?.every ?? null,
      reminder_offsets: fittingReminders(reminders.value, {
        dueDate: dueDate.value,
        dueTime: dueTime.value || null,
        recurrence: recurrence.value ?? null,
      }),
    })
    open.value = false
    emit('saved')
  } catch {
    errors.value = ['save']
  }
}
</script>

<template>
  <DialogRoot :open="open" @update:open="setOpen">
    <DialogPortal>
      <DialogOverlay class="sheet-overlay fixed inset-0 z-30 bg-black/40" />
      <DialogContent
        class="sheet-panel fixed inset-x-0 bottom-0 z-40 flex max-h-[92dvh] flex-col rounded-t-3xl bg-surface text-text shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[420px] md:rounded-none"
      >
        <header class="flex items-center gap-2 border-b border-line px-4 py-3">
          <button
            type="button"
            class="text-accent disabled:opacity-50"
            :disabled="add.isPending.value"
            @click="setOpen(false)"
          >
            {{ $t('itemForm.cancel') }}
          </button>
          <DialogTitle class="flex-1 text-center font-semibold">{{ $t('itemForm.title') }}</DialogTitle>
          <button
            type="submit"
            form="add-item"
            :disabled="add.isPending.value"
            class="rounded-full bg-accent px-4 py-1.5 font-semibold text-on-accent disabled:opacity-50"
          >
            {{ $t('itemForm.save') }}
          </button>
        </header>
        <form id="add-item" class="flex flex-col gap-5 overflow-y-auto p-4" novalidate @submit.prevent="save">
          <p
            v-if="errors.length"
            role="alert"
            class="rounded-xl bg-urgent-red/10 p-3 text-sm font-medium text-urgent-red"
          >
            <span v-for="e in errors" :key="e" class="block">{{ $t(`itemForm.errors.${e}`) }}</span>
          </p>
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">{{ $t('itemForm.name') }}</span>
            <input v-model="name" :class="input" :placeholder="$t('itemForm.namePlaceholder')" />
          </label>
          <CategoryChips v-model="category" :legend="$t('itemForm.category')" name="add-category" />
          <!-- one block, stacked: side by side they overlapped on phones -->
          <div class="flex flex-col gap-3">
            <label class="flex min-w-0 flex-col gap-1 text-sm">
              <span class="font-medium">{{ $t('itemForm.dueDate') }}</span>
              <DateTimeInput
                v-model="dueDate"
                type="date"
                :aria-label="$t('itemForm.dueDate')"
                :placeholder="$t('itemForm.chooseDate')"
              />
            </label>
            <div class="flex min-w-0 flex-col gap-1 text-sm">
              <label class="flex flex-col gap-1">
                <span class="font-medium">{{ $t('itemForm.time') }}</span>
                <DateTimeInput
                  v-model="dueTime"
                  type="time"
                  :aria-label="$t('itemForm.time')"
                  aria-describedby="add-time-hint"
                  :placeholder="$t('itemForm.noTimeAllDay')"
                />
              </label>
              <p id="add-time-hint" class="text-muted">{{ $t('itemForm.timeHint') }}</p>
            </div>
          </div>
          <RepeatPicker :key="session" v-model="recurrence" />
          <ReminderChips v-model="reminders" :due-date="dueDate" :due-time="dueTime || null" :recurrence="recurrence" />
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">{{ $t('itemForm.price') }}</span>
            <input v-model="price" inputmode="decimal" :class="input" placeholder="0.00" />
            <span class="text-muted">{{ $t('itemForm.priceHint') }}</span>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">{{ $t('itemForm.notes') }}</span>
            <textarea v-model="notes" rows="3" :class="input" />
            <span v-if="numberWarning" class="font-medium text-urgent-yellow-text">{{
              $t('itemForm.numberWarning')
            }}</span>
          </label>
        </form>
        <ToastBar in-sheet />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
