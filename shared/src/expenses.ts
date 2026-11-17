import type { Category } from './categories.ts'
import { addDays } from './dates.ts'
import { dueDatesBetween, type Recurrence } from './due-date.ts'

export interface MonthExpense {
  /** YYYY-MM-DD */
  date: string
  amount_cents: number
  category: Category
}

export interface MonthTotals {
  total: number
  /** Categories with spending, biggest first */
  byCategory: { category: Category; cents: number }[]
}

/** The total and per-Category totals of one month ("YYYY-MM"). */
export function monthTotals(expenses: MonthExpense[], month: string): MonthTotals {
  const sums = new Map<Category, number>()
  for (const e of expenses) {
    if (!e.date.startsWith(month)) continue
    sums.set(e.category, (sums.get(e.category) ?? 0) + e.amount_cents)
  }
  const byCategory = [...sums].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents)
  return { total: byCategory.reduce((s, c) => s + c.cents, 0), byCategory }
}

/** "YYYY-MM" moved by whole months. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export interface PricedItem {
  dueDate: string
  recurrence: Recurrence | null
  priceCents: number | null
  category: Category
}

/**
 * The Due dates on which a priced Item creates an Expense: after `through` (the last date already
 * handled, or null), up to and including `today`, and never before the day the Item was added.
 * Free trials and Items without a price create none. Handled makes no difference.
 */
export function automaticExpenseDates(
  item: PricedItem & { addedOn: string },
  through: string | null,
  today: string,
): string[] {
  if (!item.priceCents || item.category === 'free_trials') return []
  const from = through && addDays(through, 1) > item.addedOn ? addDays(through, 1) : item.addedOn
  if (from > today) return []
  return dueDatesBetween({ dueDate: item.dueDate, recurrence: item.recurrence }, from, today)
}

/** Priced Items still due later this month (after today), soonest first: the grey part of the ring. */
export function stillComing<T extends PricedItem & { id: string }>(
  items: T[],
  today: string,
): (T & { date: string; priceCents: number })[] {
  const monthEnd = addDays(`${shiftMonth(today.slice(0, 7), 1)}-01`, -1)
  if (today >= monthEnd) return []
  const coming: (T & { date: string; priceCents: number })[] = []
  for (const item of items) {
    if (!item.priceCents || item.category === 'free_trials') continue
    for (const date of dueDatesBetween(
      { dueDate: item.dueDate, recurrence: item.recurrence },
      addDays(today, 1),
      monthEnd,
    ))
      coming.push({ ...item, date, priceCents: item.priceCents })
  }
  return coming.sort((a, b) => a.date.localeCompare(b.date))
}
