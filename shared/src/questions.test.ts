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

describe('openQuestion after Keep in Expired', () => {
  it('asks nothing once kept in Expired for that Due date, and asks again for a new one', () => {
    const passport = { ...oneTime, dueDate: '2026-11-13', category: 'documents' } as const
    expect(openQuestion({ ...passport, keptDueDate: '2026-11-13' }, today)).toBeNull()
    expect(openQuestion({ ...passport, dueDate: '2026-11-14', keptDueDate: '2026-11-13' }, today)).toBe('expired')
    const trial = { ...oneTime, dueDate: '2026-11-10', category: 'free_trials' } as const
    expect(openQuestion({ ...trial, keptDueDate: '2026-11-10' }, today)).toBeNull()
  })

  it('asks "What now?" right after the Finish time on the Due date', () => {
    const dentist = { ...oneTime, dueDate: today, category: 'health', finishTime: '10:30' } as const
    expect(openQuestion(dentist, `${today}T10:00`)).toBeNull()
    expect(openQuestion(dentist, `${today}T11:00`)).toBe('expired')
  })
})

describe('keptTrialName', () => {
  it('drops "free trial" from the name of a kept trial', () => {
    expect(keptTrialName('Disney+ free trial')).toBe('Disney+')
    expect(keptTrialName('Free Trial - Spotify')).toBe('Spotify')
    expect(keptTrialName('Duolingo (free trial)')).toBe('Duolingo')
    expect(keptTrialName('Netflix')).toBe('Netflix')
    expect(keptTrialName('Netflix free trials')).toBe('Netflix')
    expect(keptTrialName('Carefree trial pass')).toBe('Carefree trial pass')
    expect(keptTrialName('Free trialist club')).toBe('Free trialist club')
  })
})
