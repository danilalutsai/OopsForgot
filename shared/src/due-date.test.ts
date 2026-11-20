import { describe, expect, it } from 'vitest'
import { currentDueDate, isExpired } from './due-date.ts'

describe('currentDueDate', () => {
  it('keeps a one-time Item on its Due date, even after it has passed', () => {
    expect(currentDueDate({ dueDate: '2026-11-13', recurrence: null }, '2026-11-16')).toBe('2026-11-13')
  })

  it('moves a monthly Item to its next Due date once the date has passed', () => {
    const rent = { dueDate: '2026-10-05', recurrence: { unit: 'month', every: 1 } } as const
    expect(currentDueDate(rent, '2026-11-16')).toBe('2026-12-05')
  })

  it('keeps a repeating Item on its Due date for the whole of that day', () => {
    const gym = { dueDate: '2026-10-16', recurrence: { unit: 'month', every: 1 } } as const
    expect(currentDueDate(gym, '2026-11-16')).toBe('2026-11-16')
  })

  it('puts a monthly Item due on the 31st on the last day of shorter months, and back on the 31st after', () => {
    const card = { dueDate: '2026-01-31', recurrence: { unit: 'month', every: 1 } } as const
    expect(currentDueDate(card, '2026-02-01')).toBe('2026-02-28')
    expect(currentDueDate(card, '2026-03-01')).toBe('2026-03-31')
    expect(currentDueDate(card, '2026-04-01')).toBe('2026-04-30')
  })

  it('puts a yearly Item due on 29 February on 28 February in other years', () => {
    const leap = { dueDate: '2024-02-29', recurrence: { unit: 'year', every: 1 } } as const
    expect(currentDueDate(leap, '2025-01-10')).toBe('2025-02-28')
    expect(currentDueDate(leap, '2027-06-01')).toBe('2028-02-29')
  })

  it('counts every N weeks and every N days', () => {
    expect(currentDueDate({ dueDate: '2026-11-02', recurrence: { unit: 'week', every: 2 } }, '2026-11-17')).toBe(
      '2026-11-30',
    )
    expect(currentDueDate({ dueDate: '2026-11-01', recurrence: { unit: 'day', every: 10 } }, '2026-11-16')).toBe(
      '2026-11-21',
    )
  })

  it('finds the current Due date of Items that started years ago', () => {
    expect(currentDueDate({ dueDate: '2021-11-16', recurrence: { unit: 'day', every: 1 } }, '2026-11-16')).toBe(
      '2026-11-16',
    )
    expect(currentDueDate({ dueDate: '2021-11-17', recurrence: { unit: 'week', every: 3 } }, '2026-11-16')).toBe(
      '2026-11-18',
    )
    expect(currentDueDate({ dueDate: '2001-01-31', recurrence: { unit: 'month', every: 1 } }, '2026-11-16')).toBe(
      '2026-11-30',
    )
    expect(currentDueDate({ dueDate: '1996-02-29', recurrence: { unit: 'year', every: 2 } }, '2026-11-16')).toBe(
      '2028-02-29',
    )
  })

  it('leaves a repeating Item whose first Due date is still ahead where it is', () => {
    const insurance = { dueDate: '2026-11-28', recurrence: { unit: 'year', every: 1 } } as const
    expect(currentDueDate(insurance, '2026-11-16')).toBe('2026-11-28')
  })
})

describe('isExpired', () => {
  it("is Expired when a one-time Item's Due date has passed", () => {
    expect(isExpired({ dueDate: '2026-11-13', recurrence: null }, '2026-11-16')).toBe(true)
  })

  it('is not Expired yet on the Due date itself', () => {
    expect(isExpired({ dueDate: '2026-11-16', recurrence: null }, '2026-11-16')).toBe(false)
  })

  it('with a Finish time, is Expired right after it on the Due date, not before', () => {
    const dentist = { dueDate: '2026-11-16', recurrence: null, finishTime: '10:30' }
    expect(isExpired(dentist, '2026-11-16T10:30')).toBe(false)
    expect(isExpired(dentist, '2026-11-16T10:31')).toBe(true)
    // with only the date known, it waits for the next day
    expect(isExpired(dentist, '2026-11-16')).toBe(false)
  })

  it('all day or with only a Start time, is Expired at 00:00 the next day', () => {
    expect(isExpired({ dueDate: '2026-11-16', recurrence: null }, '2026-11-16T23:59')).toBe(false)
    expect(isExpired({ dueDate: '2026-11-16', recurrence: null, finishTime: null }, '2026-11-17T00:00')).toBe(true)
  })

  it('never makes a repeating Item Expired', () => {
    expect(isExpired({ dueDate: '2026-10-05', recurrence: { unit: 'month', every: 1 } }, '2026-11-16')).toBe(false)
  })
})
