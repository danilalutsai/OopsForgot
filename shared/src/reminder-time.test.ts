import { expect, it } from 'vitest'
import { roundToQuarterHour } from './reminder-time.ts'

it('rounds a chosen day Reminder time down to a 15-minute step', () => {
  expect(roundToQuarterHour('03:07')).toBe('03:00')
  expect(roundToQuarterHour('12:00')).toBe('12:00')
  expect(roundToQuarterHour('18:44')).toBe('18:30')
  expect(roundToQuarterHour('23:59')).toBe('23:45')
})
