import { describe, expect, it } from 'vitest'
import { calendarDays } from './calendar.ts'
import { dueDatesBetween } from './due-date.ts'

describe('dueDatesBetween', () => {
  it('lists every Event date of a repeating Item inside the range', () => {
    const gym = { dueDate: '2026-10-05', recurrence: { unit: 'week', every: 2 } } as const
    expect(dueDatesBetween(gym, '2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-16', '2026-11-30'])
  })

  it('never lists dates before the first Event date', () => {
    const rent = { dueDate: '2026-11-20', recurrence: { unit: 'month', every: 1 } } as const
    expect(dueDatesBetween(rent, '2026-11-01', '2026-12-31')).toEqual(['2026-11-20', '2026-12-20'])
  })

  it('lists a one-time Item only when its Event date is inside the range', () => {
    expect(dueDatesBetween({ dueDate: '2026-11-13', recurrence: null }, '2026-11-01', '2026-11-30')).toEqual([
      '2026-11-13',
    ])
    expect(dueDatesBetween({ dueDate: '2027-03-02', recurrence: null }, '2026-11-01', '2026-11-30')).toEqual([])
  })

  it('keeps month ends right inside the range', () => {
    const card = { dueDate: '2026-01-31', recurrence: { unit: 'month', every: 1 } } as const
    expect(dueDatesBetween(card, '2026-02-01', '2026-03-31')).toEqual(['2026-02-28', '2026-03-31'])
  })
})

describe('calendarDays', () => {
  it('gives the 7 days of the week around a date, starting on the given weekday', () => {
    // 2026-11-18 is a Wednesday; 1 = Monday
    expect(calendarDays('week', '2026-11-18', 1)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ])
    expect(calendarDays('week', '2026-11-18', 7)[0]).toBe('2026-11-15')
  })

  it('gives whole weeks covering the month', () => {
    const days = calendarDays('month', '2026-11-18', 1)
    expect(days[0]).toBe('2026-10-26')
    expect(days.at(-1)).toBe('2026-12-06')
    expect(days.length % 7).toBe(0)
  })
})
