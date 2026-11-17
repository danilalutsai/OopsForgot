import { type Recurrence, type ReminderOffset, reminderChoices } from '@oopsproof/shared'
import { dayReminderTime, nowLocal } from '../today'

/** On save, Reminders that no longer fit the Item (new time, repeat or Due date) are dropped. */
export function fittingReminders(
  offsets: ReminderOffset[],
  item: { dueDate: string; dueTime: string | null; recurrence: Recurrence | null },
): ReminderOffset[] {
  const allowed = new Set(
    reminderChoices(item, nowLocal.value, dayReminderTime.value)
      .filter((c) => c.allowed)
      .map((c) => c.offset),
  )
  return offsets.filter((o) => allowed.has(o))
}
