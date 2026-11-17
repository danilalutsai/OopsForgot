/** The calendar date (YYYY-MM-DD) that `now` falls on in `timeZone`. The rules never read the clock themselves. */
export function todayIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
