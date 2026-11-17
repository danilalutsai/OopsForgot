<script setup lang="ts">
import {
  CATEGORIES,
  CATEGORY_ICONS,
  type Category,
  looksLikeFullNumber,
  parseAmount,
  type Recurrence,
} from '@oopsproof/shared'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useAddItem } from './api'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()

const name = ref('')
const category = ref<Category | null>(null)
const dueDate = ref('')
const dueTime = ref('')
const price = ref('')
const notes = ref('')
type RepeatChoice = 'none' | 'week' | 'month' | 'year' | 'custom'
const repeat = ref<RepeatChoice>('none')
const customEvery = ref('2')
const customUnit = ref<Recurrence['unit']>('month')
const errors = ref<string[]>([])
const add = useAddItem()
const numberWarning = computed(() => looksLikeFullNumber(notes.value))

/** The sheet stays open while a save is in flight, so it can't close a newer sheet when it finishes. */
function setOpen(next: boolean) {
  if (!next && add.isPending.value) return
  open.value = next
}

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = dueDate.value = dueTime.value = price.value = notes.value = ''
  category.value = null
  repeat.value = 'none'
  customEvery.value = '2'
  customUnit.value = 'month'
  errors.value = []
})

/** The chosen Recurrence, or null for a one-time Item; undefined when the custom number is invalid. */
function chosenRecurrence(): Recurrence | null | undefined {
  if (repeat.value === 'none') return null
  if (repeat.value !== 'custom') return { unit: repeat.value, every: 1 }
  const every = Number(customEvery.value)
  return Number.isInteger(every) && every >= 1 && every <= 365 ? { unit: customUnit.value, every } : undefined
}

async function save() {
  const priceCents = price.value.trim() ? parseAmount(price.value) : null
  const recurrence = chosenRecurrence()
  errors.value = [
    !name.value.trim() && 'name',
    !category.value && 'category',
    !dueDate.value && 'dueDate',
    price.value.trim() && priceCents === null && 'price',
    recurrence === undefined && 'every',
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
      recurrence_unit: recurrence?.unit ?? null,
      recurrence_every: recurrence?.every ?? null,
    })
    open.value = false
    emit('saved')
  } catch {
    errors.value = ['save']
  }
}

const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'
</script>

<template>
  <DialogRoot :open="open" @update:open="setOpen">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-30 bg-black/40" />
      <DialogContent
        class="fixed inset-x-0 bottom-0 z-40 flex max-h-[92dvh] flex-col rounded-t-3xl bg-surface text-text shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[420px] md:rounded-none"
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
          <fieldset class="flex flex-col gap-2 text-sm">
            <legend class="mb-1 font-medium">{{ $t('itemForm.category') }}</legend>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="c in CATEGORIES"
                :key="c"
                :class="[
                  'cursor-pointer rounded-full border px-3 py-1.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
                  category === c ? 'border-accent bg-accent text-on-accent' : 'border-line',
                ]"
              >
                <input v-model="category" type="radio" name="category" :value="c" class="sr-only" />
                {{ CATEGORY_ICONS[c] }} {{ $t(`categories.${c}`) }}
              </label>
            </div>
          </fieldset>
          <div class="grid grid-cols-2 gap-3">
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium">{{ $t('itemForm.dueDate') }}</span>
              <input v-model="dueDate" type="date" :class="input" />
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium">{{ $t('itemForm.time') }}</span>
              <input v-model="dueTime" type="time" :class="input" />
            </label>
          </div>
          <p class="-mt-3 text-sm text-muted">{{ $t('itemForm.timeHint') }}</p>
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">{{ $t('itemForm.repeats') }}</span>
            <select v-model="repeat" :class="input">
              <option v-for="o in ['none', 'week', 'month', 'year', 'custom'] as const" :key="o" :value="o">
                {{ $t(`itemForm.repeatOptions.${o}`) }}
              </option>
            </select>
          </label>
          <div v-if="repeat === 'custom'" class="-mt-2 flex items-center gap-2 text-sm">
            <span>{{ $t('itemForm.every') }}</span>
            <input
              v-model="customEvery"
              inputmode="numeric"
              :aria-label="$t('itemForm.every')"
              :class="[input, 'w-20']"
            />
            <select v-model="customUnit" :aria-label="$t('itemForm.repeats')" :class="[input, 'w-auto']">
              <option v-for="u in ['day', 'week', 'month', 'year'] as const" :key="u" :value="u">
                {{ $t(`itemForm.units.${u}`, Number(customEvery) || 2) }}
              </option>
            </select>
          </div>
          <p v-if="repeat !== 'none'" class="-mt-3 text-sm text-muted">{{ $t('itemForm.repeatHint') }}</p>
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
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
