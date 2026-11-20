<script setup lang="ts">
import { countdown, type OpenQuestion } from '@oopsforgot/shared'
import { computed, ref } from 'vue'
import { today } from '../today'
import { useItemActions } from './actions'
import type { Item } from './api'
import { INPUT } from './ui'
import DateTimeInput from '../components/DateTimeInput.vue'

const props = defineProps<{ item: Item; question: OpenQuestion; disabled: boolean }>()
const actions = useItemActions()
const newDate = ref('')
const unit = ref<'week' | 'month' | 'year'>('year')
const daysAgo = computed(() => {
  const left = countdown(props.item.due_date, today.value)
  return left.kind === 'expired' ? left.days : 0
})
</script>

<template>
  <section class="mx-3 mb-3 rounded-2xl bg-urgent-red/10 p-4 text-urgent-red-text" aria-live="polite">
    <template v-if="question === 'expired'">
      <h3 class="font-semibold">{{ $t('questions.expiredTitle', { days: daysAgo }, daysAgo) }}</h3>
      <div class="mt-3 flex flex-col gap-3 text-text">
        <div class="flex gap-2">
          <DateTimeInput
            v-model="newDate"
            class="flex-1"
            type="date"
            :min="today"
            :aria-label="$t('questions.newDueDate')"
            :placeholder="$t('itemForm.chooseDate')"
          />
          <button
            type="button"
            class="shrink-0 rounded-xl bg-accent px-3 font-semibold text-on-accent disabled:opacity-40"
            :disabled="disabled || !newDate || newDate < today"
            @click="actions.setNewDueDate(item, newDate)"
          >
            {{ $t('questions.setDate') }}
          </button>
        </div>
        <div class="flex gap-2">
          <select v-model="unit" :aria-label="$t('questions.repeatEvery')" :class="INPUT">
            <option v-for="u in ['week', 'month', 'year'] as const" :key="u" :value="u">
              {{ $t(`questions.every.${u}`) }}
            </option>
          </select>
          <button
            type="button"
            class="shrink-0 rounded-xl border border-line bg-surface px-3 font-semibold disabled:opacity-40"
            :disabled="disabled"
            @click="actions.makeRepeat(item, unit)"
          >
            {{ $t('questions.makeRepeat') }}
          </button>
        </div>
        <button
          type="button"
          class="rounded-xl border border-line bg-surface py-2 font-semibold disabled:opacity-40"
          :disabled="disabled"
          @click="actions.keepInExpired(item)"
        >
          {{ $t('questions.keep') }}
        </button>
      </div>
    </template>
    <template v-else>
      <h3 class="font-semibold">{{ $t('questions.trialTitle', { name: item.name }) }}</h3>
      <div class="mt-3 grid grid-cols-2 gap-2 text-text">
        <button
          type="button"
          class="rounded-xl bg-accent py-2 font-semibold text-on-accent disabled:opacity-40"
          :disabled="disabled"
          @click="actions.keepTrial(item)"
        >
          {{ $t('questions.yes') }}
        </button>
        <button
          type="button"
          class="rounded-xl border border-line bg-surface py-2 font-semibold disabled:opacity-40"
          :disabled="disabled"
          @click="actions.keepInExpired(item)"
        >
          {{ $t('questions.no') }}
        </button>
      </div>
    </template>
  </section>
</template>
