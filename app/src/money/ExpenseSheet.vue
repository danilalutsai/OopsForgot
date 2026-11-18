<script setup lang="ts">
import { CATEGORIES, type Category, parseAmount } from '@oopsproof/shared'
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
import { ref, watch } from 'vue'
import ToastBar from '../components/ToastBar.vue'
import CategoryChips from '../items/CategoryChips.vue'
import { INPUT } from '../items/ui'
import { blockedOffline } from '../online'
import { useToasts } from '../stores/toasts'
import { today } from '../today'
import { type Expense, useAddExpense, useDeleteExpense, useUpdateExpense } from './api'

const props = defineProps<{
  /** the Expense to edit, or null to add one */
  expense: Expense | null
  /** where a new Expense starts: a date and (when a Category is picked) that Category */
  startDate: string
  startCategory: Category | null
  /** the first day of the month the account was created: Money can't go back further */
  minDate: string
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [date: string] }>()

/** Free trials never cost anything, so they never hold Expenses. */
const OPTIONS = CATEGORIES.filter((c) => c !== 'free_trials')

const amount = ref('')
const category = ref<Category | null>(null)
const date = ref('')
const description = ref('')
const errors = ref<string[]>([])
const confirmingDelete = ref(false)
const add = useAddExpense()
const update = useUpdateExpense()
const remove = useDeleteExpense()
const toasts = useToasts()

watch(open, (isOpen) => {
  if (!isOpen) return
  const e = props.expense
  amount.value = e ? (e.amount_cents / 100).toFixed(2) : ''
  category.value = e?.category ?? props.startCategory
  date.value = e?.date ?? props.startDate
  description.value = e?.description ?? ''
  errors.value = []
})

const pending = () => add.isPending.value || update.isPending.value || remove.isPending.value

async function save() {
  if (blockedOffline()) return
  const cents = parseAmount(amount.value)
  errors.value = [
    cents === null && 'amount',
    !category.value && 'category',
    (!date.value || date.value > today.value || date.value < props.minDate) && 'date',
  ].filter((e): e is string => !!e)
  if (errors.value.length) return
  const input = {
    amount_cents: cents!,
    category: category.value!,
    date: date.value,
    description: description.value.trim(),
  }
  try {
    if (props.expense) await update.mutateAsync({ id: props.expense.id, ...input })
    else await add.mutateAsync(input)
    open.value = false
    toasts.show('money.sheet.saved')
    emit('saved', input.date)
  } catch {
    errors.value = ['save']
  }
}

async function confirmDelete() {
  if (!props.expense || blockedOffline()) return
  try {
    await remove.mutateAsync(props.expense.id)
    open.value = false
    toasts.show('money.sheet.deleted')
  } catch {
    errors.value = ['delete']
  }
}
</script>

<template>
  <DialogRoot :open="open" @update:open="(o) => (o || !pending()) && (open = o)">
    <DialogPortal>
      <DialogOverlay class="sheet-overlay fixed inset-0 z-30 bg-black/40" />
      <DialogContent
        class="sheet-panel fixed inset-x-0 bottom-0 z-40 flex max-h-[92dvh] flex-col rounded-t-3xl bg-surface text-text shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[420px] md:rounded-none"
      >
        <header class="flex items-center gap-2 border-b border-line px-4 py-3">
          <button type="button" class="text-accent" :disabled="pending()" @click="open = false">
            {{ $t('money.sheet.cancel') }}
          </button>
          <DialogTitle class="flex-1 text-center font-semibold">
            {{ expense ? $t('money.sheet.edit') : $t('money.sheet.new') }}
          </DialogTitle>
          <button
            type="submit"
            form="expense-form"
            :disabled="pending()"
            class="rounded-full bg-accent px-4 py-1.5 font-semibold text-on-accent disabled:opacity-50"
          >
            {{ $t('money.sheet.save') }}
          </button>
        </header>
        <form id="expense-form" class="flex flex-col gap-5 overflow-y-auto p-4" novalidate @submit.prevent="save">
          <p
            v-if="errors.length"
            role="alert"
            class="rounded-xl bg-urgent-red/10 p-3 text-sm font-medium text-urgent-red-text"
          >
            <span v-for="e in errors" :key="e" class="block">{{ $t(`money.sheet.errors.${e}`) }}</span>
          </p>
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">{{ $t('money.sheet.amount') }}</span>
            <input v-model="amount" inputmode="decimal" placeholder="0.00" :class="INPUT" />
          </label>
          <!-- an automatic Expense keeps its Item's Category (once the Item is deleted, it's like any other) -->
          <div v-if="expense?.item_id" class="flex flex-col gap-1 text-sm">
            <span class="font-medium">{{ $t('money.sheet.category') }}</span>
            <span>
              {{ category ? $t(`categories.${category}`) : '' }} ·
              <span class="text-muted">{{ $t('money.lockedCategory') }}</span>
            </span>
          </div>
          <CategoryChips
            v-else
            v-model="category"
            :legend="$t('money.sheet.category')"
            name="expense-category"
            :options="OPTIONS"
          />
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">{{ $t('money.sheet.date') }}</span>
            <input v-model="date" type="date" :min="minDate" :max="today" :class="INPUT" />
          </label>
          <p v-if="expense?.item_id && expense.item_name" class="rounded-xl bg-bg p-3 text-sm">
            {{ $t('money.fromItem', { name: expense.item_name }) }}
            <RouterLink :to="`/?item=${expense.item_id}`" class="font-semibold text-accent">
              · {{ $t('money.openItem') }}
            </RouterLink>
          </p>
          <label v-if="!expense?.item_id" class="flex flex-col gap-1 text-sm">
            <span class="font-medium">{{ $t('money.sheet.description') }}</span>
            <input v-model="description" maxlength="200" :class="INPUT" />
            <span class="text-muted">{{ $t('money.sheet.descriptionHint') }}</span>
          </label>
          <button
            v-if="expense"
            type="button"
            class="rounded-xl border border-line py-2.5 font-semibold text-urgent-red"
            @click="confirmingDelete = true"
          >
            {{ $t('money.sheet.delete') }}
          </button>
        </form>
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
        <AlertDialogTitle class="text-lg font-semibold">{{ $t('money.sheet.deleteTitle') }}</AlertDialogTitle>
        <AlertDialogDescription class="mt-1 text-muted">{{ $t('money.sheet.deleteBody') }}</AlertDialogDescription>
        <div class="mt-5 flex flex-col gap-2">
          <AlertDialogAction class="rounded-xl bg-urgent-red py-2.5 font-semibold text-white" @click="confirmDelete">
            {{ $t('money.sheet.delete') }}
          </AlertDialogAction>
          <AlertDialogCancel class="rounded-xl py-2.5 font-semibold text-accent">{{
            $t('money.sheet.cancel')
          }}</AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
