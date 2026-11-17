import { daysBetween } from './dates.ts'

export type DashboardGroup = 'today' | 'thisWeek' | 'later'

export type Countdown = { kind: 'dueToday' } | { kind: 'dueIn'; days: number } | { kind: 'expired'; days: number }

/** Which dashboard group an Item's Due date falls in. `today` is YYYY-MM-DD in the person's time zone. */
export function dashboardGroup(dueDate: string, today: string): DashboardGroup {
  const days = daysBetween(today, dueDate)
  return days <= 0 ? 'today' : days <= 7 ? 'thisWeek' : 'later'
}

/** The countdown shown on an Item's row. */
export function countdown(dueDate: string, today: string): Countdown {
  const days = daysBetween(today, dueDate)
  if (days === 0) return { kind: 'dueToday' }
  return days > 0 ? { kind: 'dueIn', days } : { kind: 'expired', days: -days }
}
