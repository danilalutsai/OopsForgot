import type { Category } from './categories.ts'
import { addDays, addMonths } from './dates.ts'
import { dueDatesBetween, type Recurrence } from './due-date.ts'
import { localToInstant } from './today.ts'

export interface FeedItem {
  id: string
  name: string
  category: Category
  dueDate: string
  dueTime: string | null
  recurrence: Recurrence | null
  handledDueDate: string | null
}

interface FeedOptions {
  /** the person's local date */
  today: string
  timeZone: string
  /** where "open the Item" links go */
  appUrl: string
  now: Date
}

/** Calendar text needs commas, semicolons, backslashes and newlines escaped. */
const escape = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n')

const utcStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

/** Long lines are folded at 75 bytes, as the calendar format asks. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let current = ''
  for (const ch of line) {
    const limit = parts.length ? 74 : 75
    if (new TextEncoder().encode(current + ch).length > limit) {
      parts.push(current)
      current = ch
    } else current += ch
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/**
 * The person's Calendar feed: each Due date as an event, 3 months back to 12 months ahead.
 * All-day, or one hour at the Item's time. Handled ones get ✓. Never notes, price or alarms
 * (Reminders come from the app, not twice from the calendar).
 */
export function calendarFeed(items: FeedItem[], { today, timeZone, appUrl, now }: FeedOptions): string {
  const from = addMonths(today, -3)
  const to = addMonths(today, 12)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OopsProof//Calendar feed//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:OopsProof',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ]
  const stamp = utcStamp(now)
  for (const item of items) {
    for (const date of dueDatesBetween({ dueDate: item.dueDate, recurrence: item.recurrence }, from, to)) {
      const handled = item.handledDueDate === date ? '✓ ' : ''
      lines.push('BEGIN:VEVENT', `UID:${item.id}-${date}@oopsproof`, `DTSTAMP:${stamp}`)
      if (item.dueTime) {
        const start = localToInstant(`${date}T${item.dueTime.slice(0, 5)}`, timeZone)
        lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(new Date(start.getTime() + 3_600_000))}`)
      } else {
        lines.push(
          `DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`,
          `DTEND;VALUE=DATE:${addDays(date, 1).replace(/-/g, '')}`,
        )
      }
      lines.push(
        `SUMMARY:${handled}${escape(item.name)} — Due`,
        `URL:${appUrl}/?item=${item.id}`,
        'TRANSP:TRANSPARENT',
        'END:VEVENT',
      )
    }
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
