import { expect, it } from 'vitest'
import { nowIn, todayIn } from './today.ts'

it("gives the calendar date in the person's time zone, not the server's", () => {
  const now = new Date('2026-11-16T23:30:00Z')
  expect(todayIn('Europe/Tallinn', now)).toBe('2026-11-17')
  expect(todayIn('America/New_York', now)).toBe('2026-11-16')
})

it("gives the local date and time in the person's time zone", () => {
  expect(nowIn('Europe/Tallinn', new Date('2026-11-16T23:30:00Z'))).toBe('2026-11-17T01:30')
  expect(nowIn('America/New_York', new Date('2026-11-16T23:30:00Z'))).toBe('2026-11-16T18:30')
})
