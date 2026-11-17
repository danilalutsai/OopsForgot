import { addDays, addMonths } from './dates.ts'

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
  if (!item.recurrence) return item.dueDate
  let n = 0
  let due = item.dueDate
  while (due < today) due = nthDueDate(item.dueDate, item.recurrence, ++n)
  return due
}

/** A one-time Item is Expired from the day after its Due date. Repeating Items never expire; they move on. */
export function isExpired(item: DatedItem, today: string): boolean {
  return item.recurrence === null && item.dueDate < today
}
