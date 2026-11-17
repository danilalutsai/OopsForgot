import { describe, expect, it } from 'vitest'
import { isHandled } from './handled.ts'

const monthly = { dueDate: '2026-10-20', recurrence: { unit: 'month', every: 1 } } as const

describe('isHandled', () => {
  it('is Handled when it was marked Handled for the Due date it is on now', () => {
    expect(isHandled({ ...monthly, handledDueDate: '2026-11-20' }, '2026-11-16')).toBe(true)
  })

  it('is no longer Handled once a repeating Item moves on to its next Due date', () => {
    expect(isHandled({ ...monthly, handledDueDate: '2026-10-20' }, '2026-11-16')).toBe(false)
  })

  it('is not Handled when it never was', () => {
    expect(isHandled({ ...monthly, handledDueDate: null }, '2026-11-16')).toBe(false)
  })
})
