import type { Category } from './categories.ts'
import { addDays, addMonths } from './dates.ts'
import { dueDatesBetween, type Recurrence } from './due-date.ts'
import { localToInstant } from './today.ts'

export interface FeedItem {
  id: string
  name: string
  category: Category
  dueDate: string
  /** Start time; none means all day */
  dueTime: string | null
  finishTime: string | null
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

/** Calendar text needs commas, semicolons, backslashes and every kind of line break escaped. */
const escape = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r\n|\r|\n/g, '\\n')

const utcStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

/** Long lines are folded at 75 bytes, as the calendar format asks. */
const encoder = new TextEncoder()
function fold(line: string): string {
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const ch of line) {
    const width = encoder.encode(ch).length
    // continuation lines start with a space, so they hold one byte less
    if (size + width > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += ch
    size += width
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/**
 * The person's Calendar feed: each Due date as an event, 3 months back to 12 months ahead.
 * All-day, or from the Start time to the Finish time (one hour when there is no Finish time). Handled ones get ✓. Never notes, price or alarms
 * (Reminders come from the app, not twice from the calendar).
 */
export function calendarFeed(items: FeedItem[], { today, timeZone, appUrl, now }: FeedOptions): string {
  const from = addMonths(today, -3)
  const to = addMonths(today, 12)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OopsForgot//Calendar feed//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:OopsForgot',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ]
  const stamp = utcStamp(now)
  for (const item of items) {
    for (const date of dueDatesBetween({ dueDate: item.dueDate, recurrence: item.recurrence }, from, to)) {
      const handled = item.handledDueDate === date ? '✓ ' : ''
      lines.push('BEGIN:VEVENT', `UID:${item.id}-${date}@oopsforgot`, `DTSTAMP:${stamp}`)
      if (item.dueTime) {
        const start = localToInstant(`${date}T${item.dueTime.slice(0, 5)}`, timeZone)
        const end = item.finishTime
          ? localToInstant(`${date}T${item.finishTime.slice(0, 5)}`, timeZone)
          : new Date(start.getTime() + 3_600_000)
        lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`)
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
