const DAY_MS = 86_400_000

const toUtc = (date: string) => Date.parse(`${date}T00:00:00Z`)
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Whole days from `from` to `to`, both YYYY-MM-DD calendar dates. */
export function daysBetween(from: string, to: string): number {
  return (toUtc(to) - toUtc(from)) / DAY_MS
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS)
}

/** Adds whole months; a day that doesn't exist in the target month falls on its last day (31 Jan + 1 month = 28 Feb). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const first = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(d, lastDay))
  return fromUtc(first.getTime())
}
