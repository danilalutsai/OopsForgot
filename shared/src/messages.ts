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
  /** the moment this Reminder was for, ISO */
  sendAt: string
}

export interface PushMessage {
  title: string
  body: string
  /** where tapping opens: that Event's details */
  url: string
  /**
   * One per Reminder (Event, date, kind and moment), so a new Reminder never silently replaces an
   * older notification still on the phone.
   */
  tag: string
}

/** "<event>-<date>-<kind>-<moment>", the moment to the minute in UTC. */
const reminderTag = (e: MessageEntry) =>
  `${e.item.id}-${e.dueDate}-${e.kind}-${e.sendAt.replace(/[-:]/g, '').slice(0, 13)}`

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** "Fri 20 Nov", built by hand: servers may lack the locale data for formatting dates. */
function dayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`)
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

function when(dueDate: string, dueTime: string | null, today: string): string {
  const days = daysBetween(today, dueDate)
  const day = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
  return dueTime ? `${day} at ${dueTime.slice(0, 5)}` : day
}

const isQuestion = (kind: ReminderKind) => kind === 'expired' || kind === 'trial'

/** The one entry that speaks for an Item: its question if it has one, else its nearest Reminder. */
function perItem(entries: MessageEntry[]): MessageEntry[] {
  const byItem = new Map<string, MessageEntry>()
  for (const e of entries) {
    const kept = byItem.get(e.item.id)
    if (!kept || (isQuestion(e.kind) && !isQuestion(kept.kind))) byItem.set(e.item.id, e)
  }
  return [...byItem.values()]
}

/**
 * The pushes for everything due for a person in one run: one per Event, so tapping any of them
 * opens that Event's details. `today` is their local date. Each Reminder has its own tag, so a
 * later push never hides an earlier one the person hasn't seen.
 */
export function pushMessages(person: SenderPerson, all: MessageEntry[], today: string): PushMessage[] {
  return perItem(all).map((entry) => messageFor(person, entry, today))
}

function messageFor(person: SenderPerson, entry: MessageEntry, today: string): PushMessage {
  const { item, dueDate, kind } = entry
  const url = `/?item=${item.id}`
  const tag = `item-${reminderTag(entry)}`
  if (kind === 'expired') {
    const ago = daysBetween(dueDate, today)
    const since = ago <= 1 ? 'yesterday' : `${ago} days ago`
    return {
      title: `${item.name} expired ${since}. What now?`,
      body: 'Set a new Event date, make it repeat, or keep it in Expired.',
      url,
      tag,
    }
  }
  if (kind === 'trial') {
    return { title: `Did you keep ${item.name}?`, body: 'Your free trial ends today.', url, tag }
  }
  return {
    title: `${person.name}, ${item.name} is ${when(dueDate, item.dueTime, today)} 🔔`,
    body: `${dayLabel(dueDate)} · ${CATEGORY_NAMES[item.category]}. Tap to mark it Handled or change it.`,
    url,
    tag,
  }
}
