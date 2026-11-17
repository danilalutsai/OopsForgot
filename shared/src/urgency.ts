import { daysBetween } from './dates.ts'

/** Items due within this many days count as due soon: yellow, and in This week. */
export const DUE_SOON_DAYS = 7

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
  return days <= 0 ? 'red' : days <= DUE_SOON_DAYS ? 'yellow' : 'green'
}
