import { describe, expect, it } from 'vitest'
import { pushMessage } from './messages.ts'

const ana = { id: 'ana', name: 'Ana', timeZone: 'Europe/Tallinn', dayReminderTime: '12:00' }
const netflix = { id: 'n1', name: 'Netflix', category: 'subscriptions' as const, dueTime: null }

describe('pushMessage', () => {
  it('names the person and the Item, says when, and never shows price or notes', () => {
    expect(pushMessage(ana, [{ item: netflix, dueDate: '2026-11-20', kind: '1d' }], '2026-11-19')).toEqual({
      title: 'Ana, Netflix is due tomorrow 🔔',
      body: 'Fri 20 Nov · Subscriptions. Tap to mark it Handled or change it.',
      url: '/?item=n1',
      tag: 'item-n1',
    })
  })

  it('says "today", "in N days" and the time for hour Reminders', () => {
    const one = (dueDate: string, kind: '1d' | '1w' | '1h', dueTime: string | null = null) =>
      pushMessage(ana, [{ item: { ...netflix, dueTime }, dueDate, kind }], '2026-11-19').title
    expect(one('2026-11-19', '1h', '14:30')).toBe('Ana, Netflix is due today at 14:30 🔔')
    expect(one('2026-11-26', '1w')).toBe('Ana, Netflix is due in 7 days 🔔')
  })

  it('bundles several Reminders into one message that opens the dashboard', () => {
    const msg = pushMessage(
      ana,
      [
        { item: netflix, dueDate: '2026-11-20', kind: '1d' },
        { item: { ...netflix, id: 'g', name: 'Gym' }, dueDate: '2026-11-21', kind: '2d' },
      ],
      '2026-11-19',
    )
    expect(msg).toEqual({ title: 'Ana, 2 Items need you soon 🔔', body: 'Netflix, Gym', url: '/', tag: 'bundle-n1-g' })
  })

  it('asks plainly, with no emoji, about Expired Items and free trials', () => {
    const passport = { id: 'p', name: 'Passport', category: 'documents' as const, dueTime: null }
    expect(pushMessage(ana, [{ item: passport, dueDate: '2026-11-18', kind: 'expired' }], '2026-11-19').title).toBe(
      'Passport expired yesterday. What now?',
    )
    const trial = { id: 't', name: 'Disney+ free trial', category: 'free_trials' as const, dueTime: null }
    expect(pushMessage(ana, [{ item: trial, dueDate: '2026-11-19', kind: 'trial' }], '2026-11-19').title).toBe(
      'Did you keep Disney+ free trial?',
    )
  })

  it('counts an Item with two Reminders in the same run once', () => {
    const trial = { id: 't', name: 'Disney+ free trial', category: 'free_trials' as const, dueTime: '16:00' }
    const msg = pushMessage(
      ana,
      [
        { item: trial, dueDate: '2026-11-19', kind: '4h' },
        { item: trial, dueDate: '2026-11-19', kind: 'trial' },
      ],
      '2026-11-19',
    )
    expect(msg.title).toBe('Did you keep Disney+ free trial?')
    expect(msg.url).toBe('/?item=t')
  })

  it('a bundle with an Expired Item or a question asks for attention, without an emoji', () => {
    const passport = { id: 'p', name: 'Passport', category: 'documents' as const, dueTime: null }
    const msg = pushMessage(
      ana,
      [
        { item: passport, dueDate: '2026-11-18', kind: 'expired' },
        { item: netflix, dueDate: '2026-11-20', kind: '1d' },
      ],
      '2026-11-19',
    )
    expect(msg.title).toBe('Ana, 2 Items need your attention')
    expect(msg.body).toBe('Passport, Netflix')
  })
})
