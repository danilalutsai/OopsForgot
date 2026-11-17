import { describe, expect, it } from 'vitest'
import { monthTotals, shiftMonth } from './expenses.ts'

const e = (date: string, amount_cents: number, category: 'home' | 'subscriptions' | 'other') => ({
  date,
  amount_cents,
  category,
})

describe('monthTotals', () => {
  it('adds up one month, per Category, biggest first', () => {
    const expenses = [
      e('2026-11-01', 75000, 'home'),
      e('2026-11-03', 1399, 'subscriptions'),
      e('2026-11-10', 1500, 'subscriptions'),
      e('2026-11-14', 6240, 'other'),
      e('2026-10-31', 9999, 'other'),
    ]
    expect(monthTotals(expenses, '2026-11')).toEqual({
      total: 84139,
      byCategory: [
        { category: 'home', cents: 75000 },
        { category: 'other', cents: 6240 },
        { category: 'subscriptions', cents: 2899 },
      ],
    })
  })

  it('is zero for an empty month', () => {
    expect(monthTotals([], '2026-11')).toEqual({ total: 0, byCategory: [] })
  })
})

describe('shiftMonth', () => {
  it('moves between months across years', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})
