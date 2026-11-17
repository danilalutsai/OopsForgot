/** The calendar date (YYYY-MM-DD) that `now` falls on in `timeZone`. The rules never read the clock themselves. */
export function todayIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Local date and time ("YYYY-MM-DDTHH:MM", 24-hour) that `now` falls on in `timeZone`. */
export function nowIn(timeZone: string, now: Date): string {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now)
  return `${todayIn(timeZone, now)}T${time}`
}
