import { addDays, addMonths } from './dates.ts'
import type { Recurrence } from './due-date.ts'

/** Every Reminder a person can pick, shortest first. Hour ones need the Item to have a time. */
export const REMINDER_OFFSETS = ['30m', '1h', '2h', '4h', '1d', '2d', '1w', '2w', '1M'] as const
export type ReminderOffset = (typeof REMINDER_OFFSETS)[number]

/** A new Item starts with one Reminder, the day before. */
export const DEFAULT_REMINDERS: ReminderOffset[] = ['1d']

const HOURS: Partial<Record<ReminderOffset, number>> = { '30m': 0.5, '1h': 1, '2h': 2, '4h': 4 }
const DAYS: Partial<Record<ReminderOffset, number>> = { '1d': 1, '2d': 2, '1w': 7, '2w': 14 }

export const isHourReminder = (offset: ReminderOffset) => offset in HOURS

/** Roughly how long before the Due date a Reminder is, in days (a month counts as 30). */
function lengthInDays(offset: ReminderOffset): number {
  return HOURS[offset] !== undefined ? HOURS[offset] / 24 : (DAYS[offset] ?? 30)
}

/** The shortest a repeat can be, in days (a month counts as 28). */
function repeatInDays({ unit, every }: Recurrence): number {
  return every * { day: 1, week: 7, month: 28, year: 365 }[unit]
}

function minusMinutes(date: string, time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number) as [number, number]
  const total = h * 60 + m - minutes
  const dayShift = Math.floor(total / 1440)
  const left = total - dayShift * 1440
  const hh = String(Math.floor(left / 60)).padStart(2, '0')
  const mm = String(left % 60).padStart(2, '0')
  return `${addDays(date, dayShift)}T${hh}:${mm}`
}

/**
 * When a Reminder goes out, as local "YYYY-MM-DDTHH:MM" in the person's time zone.
 * Day Reminders of an Item with a Start time go out at that time, that many days before; of an all-day
 * Item, at the person's day Reminder time. Hour Reminders go out that long before the Start time.
 */
export function reminderSendAt(
  dueDate: string,
  dueTime: string | null,
  offset: ReminderOffset,
  dayReminderTime: string,
): string {
  const hours = HOURS[offset]
  if (hours !== undefined) return minusMinutes(dueDate, (dueTime ?? '00:00').slice(0, 5), hours * 60)
  const day = offset === '1M' ? addMonths(dueDate, -1) : addDays(dueDate, -(DAYS[offset] ?? 0))
  return `${day}T${(dueTime ?? dayReminderTime).slice(0, 5)}`
}

export interface ReminderItem {
  dueDate: string
  dueTime: string | null
  recurrence: Recurrence | null
}

export interface ReminderChoice {
  offset: ReminderOffset
  allowed: boolean
  /** why a choice is greyed out */
  reason?: 'needsTime' | 'longerThanRepeat' | 'alreadyPast'
}

/**
 * Which Reminders fit an Item: hour ones need a time; a repeating Item's must be shorter than one repeat;
 * a one-time Item's must still be ahead of `now` ("YYYY-MM-DDTHH:MM" in the person's time zone).
 */
export function reminderChoices(item: ReminderItem, now: string, dayReminderTime: string): ReminderChoice[] {
  return REMINDER_OFFSETS.map((offset): ReminderChoice => {
    if (isHourReminder(offset) && !item.dueTime) return { offset, allowed: false, reason: 'needsTime' }
    if (item.recurrence && lengthInDays(offset) >= repeatInDays(item.recurrence))
      return { offset, allowed: false, reason: 'longerThanRepeat' }
    if (!item.recurrence && reminderSendAt(item.dueDate, item.dueTime, offset, dayReminderTime) <= now)
      return { offset, allowed: false, reason: 'alreadyPast' }
    return { offset, allowed: true }
  })
}
