import { addDays, addMonths } from './dates.ts'

/** ISO weekday (1 = Monday … 7 = Sunday) of a YYYY-MM-DD date. */
function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay() || 7
}

function startOfWeek(date: string, firstDay: number): string {
  return addDays(date, -((weekday(date) - firstDay + 7) % 7))
}

/**
 * The days a calendar shows around `anchor`: its week, or whole weeks covering its month.
 * `firstDay` is the weekday weeks start on (1 = Monday … 7 = Sunday), from the person's locale.
 */
export function calendarDays(view: 'week' | 'month', anchor: string, firstDay: number): string[] {
  const from = startOfWeek(view === 'week' ? anchor : `${anchor.slice(0, 7)}-01`, firstDay)
  const lastOfMonth = addDays(addMonths(`${anchor.slice(0, 7)}-01`, 1), -1)
  const to = view === 'week' ? addDays(from, 6) : addDays(startOfWeek(lastOfMonth, firstDay), 6)
  const days: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)
  return days
}
