import { describe, expect, it } from 'vitest'
import { localToInstant, nowIn, todayIn } from './today.ts'

it("gives the calendar date in the person's time zone, not the server's", () => {
  const now = new Date('2026-11-16T23:30:00Z')
  expect(todayIn('Europe/Tallinn', now)).toBe('2026-11-17')
  expect(todayIn('America/New_York', now)).toBe('2026-11-16')
})

it("gives the local date and time in the person's time zone", () => {
  expect(nowIn('Europe/Tallinn', new Date('2026-11-16T23:30:00Z'))).toBe('2026-11-17T01:30')
  expect(nowIn('America/New_York', new Date('2026-11-16T23:30:00Z'))).toBe('2026-11-16T18:30')
})

describe('localToInstant', () => {
  it('turns a local date and time in a time zone into the exact moment', () => {
    expect(localToInstant('2026-11-19T12:00', 'Europe/Tallinn').toISOString()).toBe('2026-11-19T10:00:00.000Z')
    expect(localToInstant('2026-07-01T12:00', 'Europe/Tallinn').toISOString()).toBe('2026-07-01T09:00:00.000Z')
    expect(localToInstant('2026-11-19T00:30', 'America/New_York').toISOString()).toBe('2026-11-19T05:30:00.000Z')
  })

  it('on the spring clock change, a time that does not exist moves forward an hour', () => {
    // 29 March 2026: Tallinn clocks jump from 03:00 to 04:00
    expect(localToInstant('2026-03-29T03:30', 'Europe/Tallinn').toISOString()).toBe('2026-03-29T01:30:00.000Z')
  })

  it('on the autumn clock change, a time that happens twice is taken the first time', () => {
    // 25 October 2026: Tallinn clocks go back from 04:00 to 03:00
    expect(localToInstant('2026-10-25T03:30', 'Europe/Tallinn').toISOString()).toBe('2026-10-25T00:30:00.000Z')
  })
})
