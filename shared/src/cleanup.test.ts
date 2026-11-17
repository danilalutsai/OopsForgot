import { describe, expect, it } from 'vitest'
import { unusedAccountStep } from './cleanup.ts'

const now = new Date('2027-11-18T03:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)
const step = (lastActive: number, warned30: number | null, warned7: number | null) =>
  unusedAccountStep(
    {
      lastActive: daysAgo(lastActive),
      warned30At: warned30 === null ? null : daysAgo(warned30),
      warned7At: warned7 === null ? null : daysAgo(warned7),
    },
    now,
  )

describe('unusedAccountStep', () => {
  it('does nothing for an account used in the last 11 months', () => {
    expect(step(334, null, null)).toBeNull()
  })

  it('warns 30 days before deletion, once', () => {
    expect(step(335, null, null)).toBe('warn30')
    expect(step(340, 5, null)).toBeNull()
  })

  it('warns again 7 days before, once', () => {
    expect(step(358, 23, null)).toBe('warn7')
    expect(step(360, 25, 2)).toBeNull()
  })

  it('deletes after 12 months without use, a week after the last warning', () => {
    expect(step(365, 30, 7)).toBe('delete')
  })

  it('never rushes: a late first warning still gives the full 30 days', () => {
    expect(step(400, null, null)).toBe('warn30')
    expect(step(401, 1, null)).toBeNull()
    expect(step(423, 23, null)).toBe('warn7')
    expect(step(424, 24, 1)).toBeNull()
    expect(step(430, 30, 7)).toBe('delete')
  })

  it('a run a few seconds early still counts the full day', () => {
    const early = new Date(now.getTime() - 2000)
    const state = { lastActive: daysAgo(358), warned30At: daysAgo(23), warned7At: null }
    expect(unusedAccountStep(state, early)).toBe('warn7')
  })
})
