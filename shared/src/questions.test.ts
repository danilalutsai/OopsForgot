import { describe, expect, it } from 'vitest'
import { keptTrialName, openQuestion } from './questions.ts'

const today = '2026-11-16'
const oneTime = { recurrence: null, handledDueDate: null }

describe('openQuestion', () => {
  it('asks "What now?" about a one-time Item past its Due date', () => {
    expect(openQuestion({ ...oneTime, dueDate: '2026-11-13', category: 'documents' }, today)).toBe('expired')
  })

  it('asks "Kept it?" about a free trial on its Due date, and after it', () => {
    expect(openQuestion({ ...oneTime, dueDate: '2026-11-16', category: 'free_trials' }, today)).toBe('keptTrial')
    expect(openQuestion({ ...oneTime, dueDate: '2026-11-10', category: 'free_trials' }, today)).toBe('keptTrial')
  })

  it('asks nothing before the Due date, about repeating Items, or once Handled', () => {
    expect(openQuestion({ ...oneTime, dueDate: '2026-11-20', category: 'free_trials' }, today)).toBeNull()
    expect(openQuestion({ ...oneTime, dueDate: '2026-11-16', category: 'documents' }, today)).toBeNull()
    const monthly = { recurrence: { unit: 'month', every: 1 }, handledDueDate: null } as const
    expect(openQuestion({ ...monthly, dueDate: '2026-10-01', category: 'home' }, today)).toBeNull()
    expect(
      openQuestion(
        { dueDate: '2026-11-13', recurrence: null, handledDueDate: '2026-11-13', category: 'documents' },
        today,
      ),
    ).toBeNull()
  })
})

describe('keptTrialName', () => {
  it('drops "free trial" from the name of a kept trial', () => {
    expect(keptTrialName('Disney+ free trial')).toBe('Disney+')
    expect(keptTrialName('Free Trial - Spotify')).toBe('Spotify')
    expect(keptTrialName('Duolingo (free trial)')).toBe('Duolingo')
    expect(keptTrialName('Netflix')).toBe('Netflix')
  })
})
