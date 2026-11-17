// Dates, times and money follow the browser's own format; months are always words so day and month can't be mixed up.

const locale = () => navigator.language

/** "16 Nov", or "2 Mar 2027" when the year isn't the current one. */
export function formatDate(date: string, today: string): string {
  const sameYear = date.slice(0, 4) === today.slice(0, 4)
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale(), {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
    timeZone: 'UTC',
  })
}

/** "14:30" or "2:30 PM", from a database time "14:30:00". */
export function formatTime(time: string): string {
  return new Date(`2000-01-01T${time}Z`).toLocaleTimeString(locale(), {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

export function formatMoney(cents: number, currency: string): string {
  return (cents / 100).toLocaleString(locale(), { style: 'currency', currency })
}
