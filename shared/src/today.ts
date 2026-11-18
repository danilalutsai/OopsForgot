/** Calendar parts of `now` in `timeZone`, independent of locale data (servers may lack full locales). */
function partsIn(timeZone: string, now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  return parts as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string>
}

/** The calendar date (YYYY-MM-DD) that `now` falls on in `timeZone`. The rules never read the clock themselves. */
export function todayIn(timeZone: string, now: Date): string {
  const p = partsIn(timeZone, now)
  return `${p.year}-${p.month}-${p.day}`
}

/** Local date and time ("YYYY-MM-DDTHH:MM", 24-hour) that `now` falls on in `timeZone`. */
export function nowIn(timeZone: string, now: Date): string {
  const p = partsIn(timeZone, now)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/** How far `timeZone` is ahead of UTC at instant `ms`, in milliseconds. */
function zoneOffset(ms: number, timeZone: string): number {
  const p = partsIn(timeZone, new Date(ms))
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return asUtc - Math.floor(ms / 1000) * 1000
}

/**
 * The exact moment a local "YYYY-MM-DDTHH:MM" happens in `timeZone`. On clock-change days a time that
 * doesn't exist moves forward by the jump, and a time that happens twice is taken the first time.
 */
export function localToInstant(local: string, timeZone: string): Date {
  const wall = Date.parse(`${local}:00Z`)
  const day = 86_400_000
  const before = zoneOffset(wall - day, timeZone)
  const after = zoneOffset(wall + day, timeZone)
  const candidates = [wall - before, wall - after].filter((t) => wall - t === zoneOffset(t, timeZone))
  return new Date(candidates.length ? Math.min(...candidates) : wall - before)
}

/** A time zone the runtime can work with; anything it doesn't know counts as UTC rather than failing. */
export function usableTimeZone(zone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return zone
  } catch {
    return 'UTC'
  }
}
