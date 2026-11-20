import { describe, expect, it } from 'vitest'
import { urgency } from './urgency.ts'

describe('urgency', () => {
  const today = '2026-11-16'

  it('is red when the Event is due today', () => {
    expect(urgency({ dueDate: '2026-11-16', handled: false }, today)).toBe('red')
  })

  it('is yellow when the Event is due within the next 7 days', () => {
    expect(urgency({ dueDate: '2026-11-23', handled: false }, today)).toBe('yellow')
  })

  it('is green when the Event is due more than 7 days away', () => {
    expect(urgency({ dueDate: '2026-11-24', handled: false }, today)).toBe('green')
  })

  it('is red when the Event is Expired', () => {
    expect(urgency({ dueDate: '2026-11-13', handled: false }, today)).toBe('red')
  })

  it('is grey when the Event is Handled, however close its Event date', () => {
    expect(urgency({ dueDate: '2026-11-16', handled: true }, today)).toBe('grey')
  })
})
