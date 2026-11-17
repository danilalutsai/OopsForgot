import { describe, expect, it } from 'vitest'
import { calendarFeed, type FeedItem } from './feed.ts'

const item = (over: Partial<FeedItem> = {}): FeedItem => ({
  id: 'i1',
  name: 'Passport',
  category: 'documents',
  dueDate: '2026-12-02',
  dueTime: null,
  recurrence: null,
  handledDueDate: null,
  ...over,
})
const feed = (items: FeedItem[]) =>
  calendarFeed(items, {
    today: '2026-11-18',
    timeZone: 'Europe/Tallinn',
    appUrl: 'https://oopsproof.pages.dev',
    now: new Date('2026-11-18T10:00:00Z'),
  })
const events = (text: string) => text.split('BEGIN:VEVENT').slice(1)

describe('calendarFeed', () => {
  it('makes an all-day event on the Due date, with a link to the Item and no alarm', () => {
    const text = feed([item()])
    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    const [e] = events(text)
    expect(e).toContain('DTSTART;VALUE=DATE:20261202\r\n')
    expect(e).toContain('DTEND;VALUE=DATE:20261203\r\n')
    expect(e).toContain('SUMMARY:Passport — Due\r\n')
    expect(e).toContain('URL:https://oopsproof.pages.dev/?item=i1\r\n')
    expect(e).not.toContain('VALARM')
  })

  it("makes a one-hour event at the Item's time, in exact time", () => {
    const [e] = events(feed([item({ dueTime: '09:30' })]))
    expect(e).toContain('DTSTART:20261202T073000Z\r\n')
    expect(e).toContain('DTEND:20261202T083000Z\r\n')
  })

  it('shows every repeat for 12 months ahead and keeps 3 months back', () => {
    const rent = item({ id: 'rent', name: 'Rent', dueDate: '2026-06-01', recurrence: { unit: 'month', every: 1 } })
    const starts = events(feed([rent])).map((e) => e.match(/DTSTART;VALUE=DATE:(\d+)/)![1])
    expect(starts[0]).toBe('20260901')
    expect(starts.at(-1)).toBe('20271101')
    expect(starts).toHaveLength(15)
  })

  it('marks a Handled Due date with ✓', () => {
    const [e] = events(feed([item({ handledDueDate: '2026-12-02' })]))
    expect(e).toContain('SUMMARY:✓ Passport — Due\r\n')
  })

  it('escapes text the calendar format treats specially', () => {
    const [e] = events(feed([item({ name: 'Car; insurance, renew\\now' })]))
    expect(e).toContain('SUMMARY:Car\\; insurance\\, renew\\\\now — Due\r\n')
  })
})
