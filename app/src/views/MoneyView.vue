<script setup lang="ts">
import {
  addDays,
  CATEGORY_ICONS,
  type Category,
  monthTotals,
  shiftMonth,
  stillComing,
  todayIn,
} from '@oopsproof/shared'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import TopBar from '../components/TopBar.vue'
import { formatDate, formatMoney, formatMonth } from '../format'
import { recurrenceOf, useItems } from '../items/api'
import { type Expense, useExpenses } from '../money/api'
import { CATEGORY_COLORS } from '../money/colors'
import ExpenseSheet from '../money/ExpenseSheet.vue'
import RingChart from '../money/RingChart.vue'
import { useAuth } from '../stores/auth'
import { currency, timeZone, today } from '../today'

const auth = useAuth()
const expenses = useExpenses()
const items = useItems()
const router = useRouter()
const { t } = useI18n()

const thisMonth = computed(() => today.value.slice(0, 7))
/** The month the account was created: the furthest back the arrows go. */
const firstMonth = computed(() => {
  const created = auth.session?.user.created_at
  return created ? todayIn(timeZone.value, new Date(created)).slice(0, 7) : thisMonth.value
})
const month = ref(thisMonth.value)
const filter = ref<Category | null>(null)

// a new month shows everything again
watch(month, () => (filter.value = null))

const monthName = formatMonth

const totals = computed(() => monthTotals(expenses.data.value ?? [], month.value))
// a filter on a Category that no longer has spending this month (last one deleted or moved) is dropped
watch(
  () => totals.value.byCategory,
  (parts) => {
    if (filter.value && !parts.some((p) => p.category === filter.value)) filter.value = null
  },
)
/** This month only: priced Items still due after today. */
const coming = computed(() =>
  month.value !== thisMonth.value
    ? []
    : stillComing(
        (items.data.value ?? [])
          .filter((i) => !i.archived_at)
          .map((i) => ({
            id: i.id,
            name: i.name,
            dueDate: i.due_date,
            recurrence: recurrenceOf(i),
            priceCents: i.price_cents,
            category: i.category,
          })),
        today.value,
      ),
)
const comingTotal = computed(() => coming.value.reduce((s, c) => s + c.priceCents, 0))

const shown = computed(() =>
  (expenses.data.value ?? []).filter(
    (e) => e.date.startsWith(month.value) && (!filter.value || e.category === filter.value),
  ),
)

function pick(category: Category) {
  filter.value = filter.value === category ? null : category
}

const label = (e: Expense) =>
  e.item_name ? t('moneyList.from', { name: e.item_name }) : e.description || t(`categories.${e.category}`)

// the add / edit sheet
const sheetOpen = ref(false)
const editing = ref<Expense | null>(null)
/** A new Expense starts today, or on the last day of the month on screen when that month is over. */
const startDate = computed(() =>
  month.value === thisMonth.value ? today.value : addDays(`${shiftMonth(month.value, 1)}-01`, -1),
)
function openNew() {
  editing.value = null
  sheetOpen.value = true
}
function openExpense(e: Expense) {
  editing.value = e
  sheetOpen.value = true
}
/** After saving, show the month the Expense is in. */
function saved(date: string) {
  month.value = date.slice(0, 7)
}
</script>

<template>
  <TopBar :title="$t('money.title')">
    <template #actions>
      <button
        type="button"
        class="mr-2 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent"
        :aria-label="$t('money.addLong')"
        @click="openNew"
      >
        + {{ $t('money.add') }}
      </button>
    </template>
  </TopBar>

  <p v-if="expenses.isError.value" role="alert" class="px-6 py-10 text-center text-urgent-red">
    {{ $t('money.loadError') }}
  </p>
  <p v-else-if="expenses.isPending.value" class="px-6 py-10 text-center text-muted">{{ $t('money.loading') }}</p>
  <div v-else class="grid gap-6 px-4 pb-28 md:grid-cols-2 md:pb-8">
    <section>
      <div class="flex items-center gap-2 py-2">
        <button
          type="button"
          class="rounded-full px-2 text-xl disabled:opacity-30"
          :aria-label="$t('money.previous')"
          :disabled="month <= firstMonth"
          @click="month = shiftMonth(month, -1)"
        >
          ‹
        </button>
        <h2 class="flex-1 text-center font-semibold" aria-live="polite">{{ monthName(month) }}</h2>
        <button
          type="button"
          class="rounded-full px-2 text-xl disabled:opacity-30"
          :aria-label="$t('money.next')"
          :disabled="month >= thisMonth"
          @click="month = shiftMonth(month, 1)"
        >
          ›
        </button>
      </div>

      <RingChart
        :parts="totals.byCategory"
        :selected="filter"
        :coming="comingTotal"
        :label="$t('money.total', { amount: formatMoney(totals.total, currency), month: monthName(month) })"
        @pick="pick"
      >
        <text x="90" y="88" text-anchor="middle" class="fill-text text-[17px] font-bold">
          {{ formatMoney(totals.total, currency) }}
        </text>
        <text x="90" y="108" text-anchor="middle" class="fill-muted text-[11px]">{{ $t('money.spent') }}</text>
      </RingChart>

      <div
        v-if="totals.byCategory.length || comingTotal"
        class="mt-4 flex flex-wrap gap-2"
        role="group"
        :aria-label="$t('money.byCategory')"
      >
        <button
          v-for="c in totals.byCategory"
          :key="c.category"
          type="button"
          :aria-pressed="filter === c.category"
          :class="[
            'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm',
            filter === c.category ? 'border-accent bg-accent/10 font-semibold' : 'border-line',
          ]"
          @click="pick(c.category)"
        >
          <span
            class="h-2.5 w-2.5 rounded-full"
            :style="{ background: CATEGORY_COLORS[c.category] }"
            aria-hidden="true"
          />
          {{ $t(`categories.${c.category}`) }} · {{ formatMoney(c.cents, currency) }}
        </button>
        <span
          v-if="comingTotal"
          class="flex items-center gap-1.5 rounded-full border border-dashed border-line px-3 py-1 text-sm text-muted"
        >
          {{ $t('money.coming', { amount: formatMoney(comingTotal, currency) }) }}
        </span>
      </div>
    </section>

    <section :aria-label="monthName(month)">
      <p v-if="filter" class="mb-2 text-sm">
        {{ $t('money.showing', { category: $t(`categories.${filter}`) }) }} ·
        <button type="button" class="font-semibold text-accent" @click="filter = null">
          {{ $t('money.showAll') }}
        </button>
      </p>
      <div v-if="expenses.isSuccess.value && !shown.length && !filter && !coming.length" class="py-6 text-center">
        <p class="font-semibold">{{ $t('money.empty') }}</p>
        <p class="mt-1 text-sm text-muted">{{ $t('money.emptyHint') }}</p>
        <button
          type="button"
          class="mt-3 rounded-full bg-accent px-4 py-1.5 font-semibold text-on-accent"
          @click="openNew"
        >
          + {{ $t('money.addLong') }}
        </button>
      </div>
      <ul>
        <li v-for="e in shown" :key="e.id" class="border-b border-line">
          <button
            type="button"
            class="flex w-full items-center gap-3 py-3 text-left hover:bg-bg"
            @click="openExpense(e)"
          >
            <span class="text-xl" aria-hidden="true">{{ CATEGORY_ICONS[e.category] }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{{ label(e) }}</span>
              <span class="block text-[13px] text-muted">
                {{ $t(`categories.${e.category}`) }} · {{ formatDate(e.date, today) }}
              </span>
            </span>
            <span class="font-semibold">{{ formatMoney(e.amount_cents, currency) }}</span>
          </button>
        </li>
      </ul>
      <template v-if="coming.length && !filter">
        <h3 class="mt-6 mb-1 text-[13px] font-semibold tracking-wide text-muted uppercase">
          {{ $t('money.comingTitle') }}
        </h3>
        <ul :aria-label="$t('money.comingTitle')">
          <li v-for="c in coming" :key="`${c.id}-${c.date}`" class="border-b border-line">
            <button
              type="button"
              class="flex w-full items-center gap-3 py-2.5 text-left text-muted hover:bg-bg"
              @click="router.push(`/?item=${c.id}`)"
            >
              <span class="w-16 shrink-0 text-[13px]">{{ formatDate(c.date, today) }}</span>
              <span class="min-w-0 flex-1 truncate">{{ c.name }}</span>
              <span>{{ formatMoney(c.priceCents, currency) }}</span>
            </button>
          </li>
        </ul>
      </template>
    </section>
  </div>

  <ExpenseSheet
    v-model:open="sheetOpen"
    :expense="editing"
    :start-date="startDate"
    :start-category="filter"
    :min-date="`${firstMonth}-01`"
    @saved="saved"
  />
</template>
