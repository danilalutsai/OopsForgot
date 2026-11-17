import type { Category } from './categories.ts'

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
