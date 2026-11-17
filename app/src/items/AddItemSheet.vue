<script setup lang="ts">
import { type Category, looksLikeFullNumber, parseAmount, type Recurrence } from '@oopsproof/shared'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useAddItem } from './api'
import CategoryChips from './CategoryChips.vue'
import RepeatPicker from './RepeatPicker.vue'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()

const name = ref('')
const category = ref<Category | null>(null)
const dueDate = ref('')
const dueTime = ref('')
const recurrence = ref<Recurrence | null | undefined>(null)
const price = ref('')
const notes = ref('')
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
  name.value = dueDate.value = dueTime.value = price.value = notes.value = ''
  category.value = null
  recurrence.value = null
  errors.value = []
  session.value++
})

async function save() {
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
          <CategoryChips v-model="category" :legend="$t('itemForm.category')" name="add-category" />
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
          <RepeatPicker :key="session" v-model="recurrence" />
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
