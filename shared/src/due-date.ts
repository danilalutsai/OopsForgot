import { addDays, addMonths, daysBetween } from './dates.ts'

export interface Recurrence {
  unit: 'day' | 'week' | 'month' | 'year'
  every: number
}

export interface DatedItem {
  /** First Due date, YYYY-MM-DD. A repeating Item counts every later Due date from it. */
  dueDate: string
  recurrence: Recurrence | null
}

/** The n-th Due date of a repeating Item, always counted from the first one so month ends never drift. */
function nthDueDate(first: string, { unit, every }: Recurrence, n: number): string {
  switch (unit) {
    case 'day':
      return addDays(first, n * every)
    case 'week':
      return addDays(first, n * every * 7)
    case 'month':
      return addMonths(first, n * every)
    case 'year':
      return addMonths(first, n * every * 12)
  }
}

/**
 * The Due date an Item is on now. `today` is YYYY-MM-DD in the person's time zone.
 * A repeating Item stays on a Due date through that whole day, then moves to the next one.
 */
export function currentDueDate(item: DatedItem, today: string): string {
  const { recurrence, dueDate: first } = item
  if (!recurrence || first >= today) return first
  // Jump close to today first so Items that started years ago don't step through every past Due date.
  let n = Math.max(0, Math.floor(roughRepeatsSince(first, recurrence, today)) - 1)
  let due = nthDueDate(first, recurrence, n)
  while (due < today) due = nthDueDate(first, recurrence, ++n)
  return due
}

/** About how many repeats fit between the first Due date and today; never more than the true count. */
function roughRepeatsSince(first: string, { unit, every }: Recurrence, today: string): number {
  const days = daysBetween(first, today)
  switch (unit) {
    case 'day':
      return days / every
    case 'week':
      return days / (7 * every)
    case 'month':
      return days / (31 * every)
    case 'year':
      return days / (366 * every)
  }
}

/**
 * A one-time Item is Expired right after its Finish time on the Due date, or (all day, or with only a
 * Start time) from 00:00 the next day. Repeating Items never expire; they move on.
 * `now` is the person's local "YYYY-MM-DDTHH:MM", or just "YYYY-MM-DD" when the time doesn't matter.
 */
export function isExpired(item: DatedItem & { finishTime?: string | null }, now: string): boolean {
  if (item.recurrence !== null) return false
  const today = now.slice(0, 10)
  if (item.dueDate < today) return true
  const time = now.slice(11, 16)
  return item.dueDate === today && !!item.finishTime && !!time && time > item.finishTime.slice(0, 5)
}

/** Every Due date of the Item from `from` to `to` (YYYY-MM-DD, both included), never before its first one. */
export function dueDatesBetween(item: DatedItem, from: string, to: string): string[] {
  const { recurrence, dueDate: first } = item
  if (!recurrence) return first >= from && first <= to ? [first] : []
  const dates: string[] = []
  let n = first >= from ? 0 : Math.max(0, Math.floor(roughRepeatsSince(first, recurrence, from)) - 1)
  for (let due = nthDueDate(first, recurrence, n); due <= to; due = nthDueDate(first, recurrence, ++n)) {
    if (due >= from) dates.push(due)
  }
  return dates
}
