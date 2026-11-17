import { describe, expect, it } from 'vitest'
import { automaticExpenseDates, monthTotals, shiftMonth, stillComing } from './expenses.ts'

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

describe('automaticExpenseDates', () => {
  const rent = {
    dueDate: '2026-09-01',
    recurrence: { unit: 'month', every: 1 },
    priceCents: 75000,
    category: 'home',
    addedOn: '2026-09-05',
  } as const

  it('creates an Expense on each Due date since the last time, up to today', () => {
    expect(automaticExpenseDates(rent, '2026-10-01', '2026-11-16')).toEqual(['2026-11-01'])
    expect(automaticExpenseDates(rent, null, '2026-11-16')).toEqual(['2026-10-01', '2026-11-01'])
  })

  it('never back-fills Due dates from before the Item was added', () => {
    expect(automaticExpenseDates(rent, null, '2026-09-30')).toEqual([])
  })

  it('includes a Due date that is today', () => {
    expect(automaticExpenseDates(rent, '2026-10-01', '2026-11-01')).toEqual(['2026-11-01'])
  })

  it('creates nothing for Items without a price, and never for free trials', () => {
    expect(automaticExpenseDates({ ...rent, priceCents: null }, null, '2026-11-16')).toEqual([])
    expect(automaticExpenseDates({ ...rent, category: 'free_trials' }, null, '2026-11-16')).toEqual([])
  })

  it('a one-time priced Item creates one Expense on its Due date', () => {
    const repair = { ...rent, recurrence: null, dueDate: '2026-11-10', addedOn: '2026-11-01' }
    expect(automaticExpenseDates(repair, null, '2026-11-16')).toEqual(['2026-11-10'])
    expect(automaticExpenseDates(repair, '2026-11-10', '2026-11-16')).toEqual([])
  })
})

describe('stillComing', () => {
  it('lists priced Items due later this month, soonest first', () => {
    const items = [
      {
        id: 'gym',
        name: 'Gym',
        dueDate: '2026-10-18',
        recurrence: { unit: 'month', every: 1 },
        priceCents: 3500,
        category: 'health',
      },
      {
        id: 'car',
        name: 'Car insurance',
        dueDate: '2026-11-28',
        recurrence: null,
        priceCents: 42000,
        category: 'vehicle',
      },
      { id: 'rent', name: 'Rent', dueDate: '2026-12-01', recurrence: null, priceCents: 75000, category: 'home' },
      { id: 'trial', name: 'Trial', dueDate: '2026-11-20', recurrence: null, priceCents: 999, category: 'free_trials' },
      {
        id: 'pass',
        name: 'Passport',
        dueDate: '2026-11-25',
        recurrence: null,
        priceCents: null,
        category: 'documents',
      },
      {
        id: 'net',
        name: 'Netflix',
        dueDate: '2026-11-16',
        recurrence: null,
        priceCents: 1399,
        category: 'subscriptions',
      },
    ] as const
    expect(stillComing([...items], '2026-11-16').map((c) => [c.id, c.date, c.priceCents])).toEqual([
      ['gym', '2026-11-18', 3500],
      ['car', '2026-11-28', 42000],
    ])
  })

  it('leaves out a bill already marked Handled for that Due date', () => {
    const gym = {
      id: 'gym',
      name: 'Gym',
      dueDate: '2026-11-25',
      recurrence: null,
      priceCents: 3500,
      category: 'health',
      handledDueDate: '2026-11-25',
    } as const
    expect(stillComing([gym], '2026-11-16')).toEqual([])
  })
})
