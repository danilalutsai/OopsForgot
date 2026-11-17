import { describe, expect, it } from 'vitest'
import { countdown, dashboardGroup } from './dashboard.ts'
import { urgency } from './urgency.ts'

const today = '2026-11-16'

describe('dashboardGroup', () => {
  it('puts an Item due today in Today', () => {
    expect(dashboardGroup('2026-11-16', today)).toBe('today')
  })

  it('puts an Expired Item in Today', () => {
    expect(dashboardGroup('2026-11-13', today)).toBe('today')
  })

  it('puts Items due in the next 7 days in This week', () => {
    expect(dashboardGroup('2026-11-17', today)).toBe('thisWeek')
    expect(dashboardGroup('2026-11-23', today)).toBe('thisWeek')
  })

  it('puts Items due after that in Later', () => {
    expect(dashboardGroup('2026-11-24', today)).toBe('later')
  })
})

describe('countdown', () => {
  it('says the Item is due today', () => {
    expect(countdown('2026-11-16', today)).toEqual({ kind: 'dueToday' })
  })

  it('counts the days until the Due date', () => {
    expect(countdown('2026-11-18', today)).toEqual({ kind: 'dueIn', days: 2 })
  })

  it('counts the days since an Expired Item was due', () => {
    expect(countdown('2026-11-13', today)).toEqual({ kind: 'expired', days: 3 })
  })
})

it('keeps the dashboard group and the urgency colour in step for every day', () => {
  const colourOf = { today: 'red', thisWeek: 'yellow', later: 'green' } as const
  for (const due of ['2026-11-10', '2026-11-16', '2026-11-17', '2026-11-23', '2026-11-24', '2027-01-01']) {
    expect(urgency({ dueDate: due, handled: false }, today)).toBe(colourOf[dashboardGroup(due, today)])
  }
})
