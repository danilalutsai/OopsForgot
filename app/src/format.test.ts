import { describe, expect, it } from 'vitest'
import { formatDateTime, formatTime, formatTimes } from './format'

describe('times', () => {
  it('are always on the 24-hour clock, never AM/PM', () => {
    expect(formatTime('17:45:00')).toBe('17:45')
    expect(formatTime('09:05')).toBe('09:05')
    expect(formatTime('00:00')).toBe('00:00')
    expect(formatTimes('16:50', '17:50')).toBe('16:50 – 17:50')
    expect(formatDateTime(new Date(2026, 10, 20, 17, 45).getTime())).toMatch(/17:45/)
    expect(formatDateTime(new Date(2026, 10, 20, 17, 45).getTime())).not.toMatch(/PM/i)
  })
})
