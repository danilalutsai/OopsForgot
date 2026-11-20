import { describe, expect, it } from 'vitest'
import { reminderChoices, reminderSendAt } from './reminders.ts'

const now = '2026-11-16T10:00'
const offsetsAllowed = (item: Parameters<typeof reminderChoices>[0], at = now) =>
  reminderChoices(item, at, '12:00')
    .filter((c) => c.allowed)
    .map((c) => c.offset)

describe('reminderSendAt', () => {
  it("sends day Reminders of an all-day Event at the person's day Reminder time, that many days before", () => {
    expect(reminderSendAt('2026-11-20', null, '1d', '12:00')).toBe('2026-11-19T12:00')
    expect(reminderSendAt('2026-11-20', null, '1w', '08:15')).toBe('2026-11-13T08:15')
    expect(reminderSendAt('2026-03-31', null, '1M', '12:00')).toBe('2026-02-28T12:00')
  })

  it('sends day Reminders of an Event with a Start time at that time, that many days before', () => {
    expect(reminderSendAt('2026-11-21', '16:50', '1d', '12:00')).toBe('2026-11-20T16:50')
    expect(reminderSendAt('2026-11-20', '09:30', '1w', '08:15')).toBe('2026-11-13T09:30')
    expect(reminderSendAt('2026-03-31', '14:00', '1M', '12:00')).toBe('2026-02-28T14:00')
  })

  it("sends hour Reminders that long before the Event's time", () => {
    expect(reminderSendAt('2026-11-20', '09:30', '30m', '12:00')).toBe('2026-11-20T09:00')
    expect(reminderSendAt('2026-11-20', '01:00', '2h', '12:00')).toBe('2026-11-19T23:00')
  })
})

describe('reminderChoices', () => {
  it('offers hour Reminders only for Events with a time', () => {
    const noTime = { dueDate: '2026-12-20', dueTime: null, recurrence: null }
    expect(offsetsAllowed(noTime)).toEqual(['1d', '2d', '1w', '2w', '1M'])
    const choice = reminderChoices(noTime, now, '12:00').find((c) => c.offset === '1h')
    expect(choice).toEqual({ offset: '1h', allowed: false, reason: 'needsTime' })
  })

  it('keeps Reminders of a repeating Event shorter than one repeat', () => {
    const weekly = { dueDate: '2026-12-20', dueTime: null, recurrence: { unit: 'week', every: 1 } } as const
    expect(offsetsAllowed(weekly)).toEqual(['1d', '2d'])
    const monthly = { ...weekly, recurrence: { unit: 'month', every: 1 } } as const
    expect(offsetsAllowed(monthly)).toEqual(['1d', '2d', '1w', '2w'])
    const yearly = { ...weekly, recurrence: { unit: 'year', every: 1 } } as const
    expect(offsetsAllowed(yearly)).toEqual(['1d', '2d', '1w', '2w', '1M'])
    const reason = reminderChoices(weekly, now, '12:00').find((c) => c.offset === '1w')?.reason
    expect(reason).toBe('longerThanRepeat')
  })

  it('offers "1 day" for tomorrow at 16:50 when it is 15:43 today (past the 12:00 day Reminder time)', () => {
    const tomorrow = { dueDate: '2026-11-21', dueTime: '16:50', recurrence: null }
    expect(offsetsAllowed(tomorrow, '2026-11-20T15:43')).toEqual(['30m', '1h', '2h', '4h', '1d'])
    // a minute after the Start time the day before, it is gone
    expect(offsetsAllowed(tomorrow, '2026-11-20T16:50')).toEqual(['30m', '1h', '2h', '4h'])
  })

  it('offers a one-time Event only Reminders still ahead of now', () => {
    const soon = { dueDate: '2026-11-19', dueTime: null, recurrence: null }
    expect(offsetsAllowed(soon)).toEqual(['1d', '2d'])
    expect(reminderChoices(soon, now, '12:00').find((c) => c.offset === '1w')?.reason).toBe('alreadyPast')
  })
})
