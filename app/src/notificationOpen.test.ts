import { describe, expect, it } from 'vitest'
import { pendingPath, safePath } from './notificationOpen'

describe('opening an Event from a Reminder', () => {
  const now = 1_000_000_000
  it('goes to a tap made in the last minute', () => {
    expect(pendingPath({ path: '/?item=abc', at: now - 5_000 }, now)).toBe('/?item=abc')
  })
  it('ignores an old tap, or none', () => {
    expect(pendingPath({ path: '/?item=abc', at: now - 61_000 }, now)).toBeNull()
    expect(pendingPath(undefined, now)).toBeNull()
  })
  it('only goes to places inside the app', () => {
    expect(safePath('https://evil.test/')).toBeNull()
    expect(safePath('//evil.test/')).toBeNull()
    expect(safePath('/settings')).toBe('/settings')
  })
})
