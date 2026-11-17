import { describe, expect, it } from 'vitest'
import { dueReminders, type SenderItem } from './sender.ts'

const ana = { id: 'ana', name: 'Ana', timeZone: 'Europe/Tallinn', dayReminderTime: '12:00' }
const item = (over: Partial<SenderItem> = {}): SenderItem => ({
  id: 'netflix',
  name: 'Netflix',
  category: 'subscriptions',
  dueDate: '2026-11-20',
  dueTime: null,
  recurrence: null,
  reminderOffsets: ['1d'],
  handledDueDate: null,
  createdAt: new Date('2026-11-01T00:00:00Z'),
  ...over,
})
// Tallinn is UTC+2 in November: day Reminders at 12:00 local go out at 10:00 UTC
const window = (from: string, to: string) => [new Date(from), new Date(to)] as const
const kinds = (r: ReturnType<typeof dueReminders>) => r.map((x) => `${x.itemId} ${x.dueDate} ${x.kind}`)

describe('dueReminders', () => {
  it('sends a day Reminder in the 15 minutes that hold its moment, and not in the ones around it', () => {
    expect(kinds(dueReminders(ana, [item()], ...window('2026-11-19T09:45Z', '2026-11-19T10:00Z')))).toEqual([
      'netflix 2026-11-20 1d',
    ])
    expect(dueReminders(ana, [item()], ...window('2026-11-19T09:30Z', '2026-11-19T09:45Z'))).toEqual([])
    expect(dueReminders(ana, [item()], ...window('2026-11-19T10:00Z', '2026-11-19T10:15Z'))).toEqual([])
  })

  it("sends hour Reminders that long before the Item's time", () => {
    const dentist = item({ id: 'dentist', dueTime: '09:30', reminderOffsets: ['1h'] })
    expect(kinds(dueReminders(ana, [dentist], ...window('2026-11-20T06:15Z', '2026-11-20T06:30Z')))).toEqual([
      'dentist 2026-11-20 1h',
    ])
  })

  it('sends nothing for a Due date marked Handled, and starts again for the next one', () => {
    const rent = item({ id: 'rent', dueDate: '2026-10-20', recurrence: { unit: 'month', every: 1 } })
    const handled = { ...rent, handledDueDate: '2026-11-20' }
    expect(dueReminders(ana, [handled], ...window('2026-11-19T09:45Z', '2026-11-19T10:00Z'))).toEqual([])
    expect(kinds(dueReminders(ana, [handled], ...window('2026-12-19T09:45Z', '2026-12-19T10:00Z')))).toEqual([
      'rent 2026-12-20 1d',
    ])
  })

  it('catches up after a skipped run while the Due date has not passed', () => {
    // runs failed from 09:30 to 13:00; the 10:00 UTC Reminder still goes out
    expect(kinds(dueReminders(ana, [item()], ...window('2026-11-19T09:30Z', '2026-11-19T13:00Z')))).toEqual([
      'netflix 2026-11-20 1d',
    ])
    // ...but not once the Due date itself is over
    expect(dueReminders(ana, [item()], ...window('2026-11-19T09:30Z', '2026-11-21T00:00Z'))).toEqual([])
  })

  it('never sends a Reminder whose moment was before the Item was added', () => {
    const late = item({ createdAt: new Date('2026-11-19T11:00:00Z') })
    expect(dueReminders(ana, [late], ...window('2026-11-19T09:30Z', '2026-11-19T11:15Z'))).toEqual([])
  })

  it('sends one "Expired" message the day after a one-time Item\'s Due date', () => {
    const passport = item({ id: 'passport', category: 'documents', reminderOffsets: [] })
    expect(kinds(dueReminders(ana, [passport], ...window('2026-11-21T09:45Z', '2026-11-21T10:00Z')))).toEqual([
      'passport 2026-11-20 expired',
    ])
    expect(
      dueReminders(
        ana,
        [{ ...passport, handledDueDate: '2026-11-20' }],
        ...window('2026-11-21T09:45Z', '2026-11-21T10:00Z'),
      ),
    ).toEqual([])
  })

  it('asks "Did you keep it?" on a free trial\'s Due date instead of an Expired message', () => {
    const trial = item({ id: 'trial', category: 'free_trials', reminderOffsets: [] })
    expect(kinds(dueReminders(ana, [trial], ...window('2026-11-20T09:45Z', '2026-11-20T10:00Z')))).toEqual([
      'trial 2026-11-20 trial',
    ])
    expect(dueReminders(ana, [trial], ...window('2026-11-21T09:45Z', '2026-11-21T10:00Z'))).toEqual([])
  })

  it('a Reminder exactly on a 15-minute boundary belongs to the window that ends there', () => {
    const noon = { ...ana, dayReminderTime: '12:15' }
    expect(kinds(dueReminders(noon, [item()], ...window('2026-11-19T10:00Z', '2026-11-19T10:15Z')))).toEqual([
      'netflix 2026-11-20 1d',
    ])
    expect(dueReminders(noon, [item()], ...window('2026-11-19T10:15Z', '2026-11-19T10:30Z'))).toEqual([])
  })

  it('sends the trial question and the Expired message only on their own day, never late', () => {
    const trial = item({ id: 'trial', category: 'free_trials', reminderOffsets: [] })
    // runs failed all of the Due date; the next run (next morning) must not say "ends today"
    expect(dueReminders(ana, [trial], ...window('2026-11-20T08:00Z', '2026-11-21T08:00Z'))).toEqual([])
    const passport = item({ id: 'passport', category: 'documents', reminderOffsets: [] })
    expect(dueReminders(ana, [passport], ...window('2026-11-21T08:00Z', '2026-11-23T08:00Z'))).toEqual([])
  })
})
