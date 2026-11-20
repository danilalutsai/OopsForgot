import type { Category } from './categories.ts'
import { addDays } from './dates.ts'
import { dueDatesBetween, type Recurrence } from './due-date.ts'
import { type ReminderOffset, reminderSendAt } from './reminders.ts'
import { localToInstant, todayIn } from './today.ts'

export interface SenderPerson {
  id: string
  name: string
  timeZone: string
  /** "HH:MM" */
  dayReminderTime: string
}

export interface SenderItem {
  id: string
  name: string
  category: Category
  dueDate: string
  dueTime: string | null
  recurrence: Recurrence | null
  reminderOffsets: ReminderOffset[]
  handledDueDate: string | null
  /** the Due date the person chose "Keep in Expired" for: no question about it any more */
  keptDueDate: string | null
  createdAt: Date
}

/** A Reminder before a Due date, the "Expired" message the day after, or the free-trial question. */
export type ReminderKind = ReminderOffset | 'expired' | 'trial'

export interface DueReminder {
  itemId: string
  dueDate: string
  kind: ReminderKind
  sendAt: Date
}

/**
 * Every Reminder of one person whose moment falls in the window (`from`, `to`]. The window is
 * "since the last run that worked", so Reminders missed by failed runs go out late, as long as
 * their Due date isn't over.
 */
export function dueReminders(person: SenderPerson, items: SenderItem[], from: Date, to: Date): DueReminder[] {
  const { timeZone, dayReminderTime } = person
  const today = todayIn(timeZone, to)
  // Reminders reach at most a month ahead; Expired messages look back one day
  const first = addDays(todayIn(timeZone, from), -1)
  const last = addDays(today, 32)
  const inWindow = (at: Date) => at > from && at <= to
  const out: DueReminder[] = []

  for (const item of items) {
    const oneTime = !item.recurrence
    const consider = (dueDate: string, kind: ReminderKind, local: string) => {
      const sendAt = localToInstant(local, timeZone)
      if (inWindow(sendAt) && sendAt >= item.createdAt) out.push({ itemId: item.id, dueDate, kind, sendAt })
    }

    for (const due of dueDatesBetween({ dueDate: item.dueDate, recurrence: item.recurrence }, first, last)) {
      if (item.handledDueDate === due) continue
      if (due >= today) {
        for (const offset of item.reminderOffsets) {
          consider(due, offset, reminderSendAt(due, item.dueTime, offset, dayReminderTime))
        }
      }
      // the trial question and the Expired message only make sense on their own day, never late,
      // and not once the question was answered with "Keep in Expired"
      if (item.keptDueDate === due) continue
      if (oneTime && item.category === 'free_trials') {
        if (today === due) consider(due, 'trial', `${due}T${dayReminderTime}`)
      } else if (oneTime && today === addDays(due, 1)) {
        consider(due, 'expired', `${addDays(due, 1)}T${dayReminderTime}`)
      }
    }
  }
  return out.sort((a, b) => a.sendAt.getTime() - b.sendAt.getTime())
}
