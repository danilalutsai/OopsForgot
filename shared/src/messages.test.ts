import { describe, expect, it } from 'vitest'
import { type MessageEntry, pushMessages } from './messages.ts'

const ana = { id: 'ana', name: 'Ana', timeZone: 'Europe/Tallinn', dayReminderTime: '12:00' }
const netflix = { id: 'n1', name: 'Netflix', category: 'subscriptions' as const, dueTime: null }

/** The one push for a single Event's Reminders. */
const pushMessage = (...args: [typeof ana, MessageEntry[], string]) => {
  const all = pushMessages(...args)
  expect(all).toHaveLength(1)
  return all[0]!
}

describe('pushMessages', () => {
  it('names the person and the Event, says when, and never shows price or notes', () => {
    expect(
      pushMessage(
        ana,
        [{ item: netflix, dueDate: '2026-11-20', kind: '1d', sendAt: '2026-11-19T10:00:00.000Z' }],
        '2026-11-19',
      ),
    ).toEqual({
      title: 'Ana, Netflix is tomorrow 🔔',
      body: 'Fri 20 Nov · Subscriptions. Tap to mark it Handled or change it.',
      url: '/?item=n1',
      tag: 'item-n1-2026-11-20-1d-20261119T1000',
    })
  })

  it('says "today", "in N days" and the time for hour Reminders', () => {
    const one = (dueDate: string, kind: '1d' | '1w' | '1h', dueTime: string | null = null) =>
      pushMessage(
        ana,
        [{ item: { ...netflix, dueTime }, dueDate, kind, sendAt: '2026-11-19T10:00:00.000Z' }],
        '2026-11-19',
      ).title
    expect(one('2026-11-19', '1h', '14:30')).toBe('Ana, Netflix is today at 14:30 🔔')
    expect(one('2026-11-26', '1w')).toBe('Ana, Netflix is in 7 days 🔔')
  })

  it('sends several Events due at once as separate pushes, each opening its own Event', () => {
    const msgs = pushMessages(
      ana,
      [
        { item: netflix, dueDate: '2026-11-20', kind: '1d', sendAt: '2026-11-19T10:00:00.000Z' },
        {
          item: { ...netflix, id: 'g', name: 'Gym' },
          dueDate: '2026-11-21',
          kind: '2d',
          sendAt: '2026-11-19T10:00:00.000Z',
        },
      ],
      '2026-11-19',
    )
    expect(msgs.map((m) => [m.title, m.url])).toEqual([
      ['Ana, Netflix is tomorrow 🔔', '/?item=n1'],
      ['Ana, Gym is in 2 days 🔔', '/?item=g'],
    ])
    expect(msgs[0]!.tag).not.toBe(msgs[1]!.tag)
  })

  it('asks plainly, with no emoji, about Expired Events and free trials', () => {
    const passport = { id: 'p', name: 'Passport', category: 'documents' as const, dueTime: null }
    expect(
      pushMessage(
        ana,
        [{ item: passport, dueDate: '2026-11-18', kind: 'expired', sendAt: '2026-11-19T10:00:00.000Z' }],
        '2026-11-19',
      ).title,
    ).toBe('Passport expired yesterday. What now?')
    const trial = { id: 't', name: 'Disney+ free trial', category: 'free_trials' as const, dueTime: null }
    expect(
      pushMessage(
        ana,
        [{ item: trial, dueDate: '2026-11-19', kind: 'trial', sendAt: '2026-11-19T10:00:00.000Z' }],
        '2026-11-19',
      ).title,
    ).toBe('Did you keep Disney+ free trial?')
  })

  it('counts an Event with two Reminders in the same run once', () => {
    const trial = { id: 't', name: 'Disney+ free trial', category: 'free_trials' as const, dueTime: '16:00' }
    const msg = pushMessage(
      ana,
      [
        { item: trial, dueDate: '2026-11-19', kind: '4h', sendAt: '2026-11-19T10:00:00.000Z' },
        { item: trial, dueDate: '2026-11-19', kind: 'trial', sendAt: '2026-11-19T10:00:00.000Z' },
      ],
      '2026-11-19',
    )
    expect(msg.title).toBe('Did you keep Disney+ free trial?')
    expect(msg.url).toBe('/?item=t')
  })

  it('an Expired Event due with another still gets its own question', () => {
    const passport = { id: 'p', name: 'Passport', category: 'documents' as const, dueTime: null }
    const msgs = pushMessages(
      ana,
      [
        { item: passport, dueDate: '2026-11-18', kind: 'expired', sendAt: '2026-11-19T10:00:00.000Z' },
        { item: netflix, dueDate: '2026-11-20', kind: '1d', sendAt: '2026-11-19T10:00:00.000Z' },
      ],
      '2026-11-19',
    )
    expect(msgs.map((m) => m.title)).toEqual(['Passport expired yesterday. What now?', 'Ana, Netflix is tomorrow 🔔'])
    expect(msgs.map((m) => m.url)).toEqual(['/?item=p', '/?item=n1'])
  })
})
