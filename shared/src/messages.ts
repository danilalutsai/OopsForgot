// The words of push Reminders. The app's screens keep their text in its translation file; the
// Reminder sender has no screens, so its (English) words live here, in the decided voice:
// plain and friendly, the first name, one emoji on heads-up lines, never price, notes or digits.
import type { Category } from './categories.ts'
import { daysBetween } from './dates.ts'
import type { ReminderKind, SenderPerson } from './sender.ts'

const CATEGORY_NAMES: Record<Category, string> = {
  documents: 'Documents',
  cards: 'Cards',
  subscriptions: 'Subscriptions',
  free_trials: 'Free trials',
  vehicle: 'Vehicle',
  home: 'Home',
  health: 'Health',
  purchases: 'Purchases',
  travel: 'Travel',
  other: 'Other',
}

export interface MessageEntry {
  item: { id: string; name: string; category: Category; dueTime: string | null }
  dueDate: string
  kind: ReminderKind
}

export interface PushMessage {
  title: string
  body: string
  /** where tapping opens: the Item, or the dashboard for a bundle */
  url: string
  /** later messages replace earlier ones instead of piling up */
  tag: string
}

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })

function when(dueDate: string, dueTime: string | null, today: string): string {
  const days = daysBetween(today, dueDate)
  const day = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
  return dueTime ? `${day} at ${dueTime.slice(0, 5)}` : day
}

/** One push for everything due for a person in one run. `today` is their local date. */
export function pushMessage(person: SenderPerson, entries: MessageEntry[], today: string): PushMessage {
  const tag = 'reminders'
  if (entries.length > 1) {
    return {
      title: `${person.name}, ${entries.length} Items need you soon 🔔`,
      body: entries.map((e) => e.item.name).join(', '),
      url: '/',
      tag,
    }
  }
  const { item, dueDate, kind } = entries[0]!
  const url = `/?item=${item.id}`
  if (kind === 'expired') {
    const ago = daysBetween(dueDate, today)
    const since = ago <= 1 ? 'yesterday' : `${ago} days ago`
    return {
      title: `${item.name} expired ${since}. What now?`,
      body: 'Set a new Due date, make it repeat, or archive it.',
      url,
      tag,
    }
  }
  if (kind === 'trial') {
    return { title: `Did you keep ${item.name}?`, body: 'Your free trial ends today.', url, tag }
  }
  return {
    title: `${person.name}, ${item.name} is due ${when(dueDate, item.dueTime, today)} 🔔`,
    body: `${dayLabel(dueDate)} · ${CATEGORY_NAMES[item.category]}. Tap to mark it Handled or change it.`,
    url,
    tag,
  }
}
