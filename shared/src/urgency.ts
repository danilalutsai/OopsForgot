import { daysBetween } from './dates.ts'

export type Urgency = 'red' | 'yellow' | 'green' | 'grey'

export interface UrgencyInput {
  /** Due date as YYYY-MM-DD */
  dueDate: string
  handled: boolean
}

/** `today` is YYYY-MM-DD in the person's own time zone. */
export function urgency(item: UrgencyInput, today: string): Urgency {
  if (item.handled) return 'grey'
  const days = daysBetween(today, item.dueDate)
  return days <= 0 ? 'red' : days <= 7 ? 'yellow' : 'green'
}
