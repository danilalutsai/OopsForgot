import { DEFAULT_REMINDERS, type Recurrence, type ReminderOffset, reminderChoices } from '@oopsproof/shared'
import { dayReminderTime, nowLocal, today } from '../today'

interface FitItem {
  dueDate: string
  dueTime: string | null
  recurrence: Recurrence | null
}

/**
 * The Reminders that still fit the Item; the rest are dropped on save.
 * An Expired one-time Item keeps its Reminders: nothing is sent while it waits for a new Due date,
 * and they apply again once it gets one.
 */
export function fittingReminders(offsets: ReminderOffset[], item: FitItem): ReminderOffset[] {
  const expired = !item.recurrence && item.dueDate < today.value
  const fits = new Set(
    reminderChoices(item, nowLocal.value, dayReminderTime.value)
      .filter((c) => c.allowed || (expired && c.reason === 'alreadyPast'))
      .map((c) => c.offset),
  )
  return offsets.filter((o) => fits.has(o))
}

/** Like fittingReminders, but falls back to the default (1 day before) when nothing would be left. */
export function fittingOrDefault(offsets: ReminderOffset[], item: FitItem): ReminderOffset[] {
  const kept = fittingReminders(offsets, item)
  return kept.length ? kept : fittingReminders(DEFAULT_REMINDERS, item)
}
