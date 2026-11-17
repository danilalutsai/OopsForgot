/** An account unused this long is deleted (long enough for a yearly Reminder to arrive first). */
export const UNUSED_DELETE_DAYS = 365
const DAY = 86_400_000

export interface UsageState {
  lastActive: Date
  /** when the 30-day warning went out, if it has */
  warned30At: Date | null
  /** when the 7-day warning went out, if it has */
  warned7At: Date | null
}

/** Whole days between two moments, rounded, so a daily run starting a few seconds early or late counts the same. */
const daysSince = (from: Date, now: Date) => Math.round((now.getTime() - from.getTime()) / DAY)

/**
 * What to do today about an account's inactivity: warn 30 days before, warn 7 days before, then
 * delete after 12 months. Warnings are never skipped or rushed: after a late first warning the
 * person still gets the full 30 days, and deletion always comes a week after the last warning.
 */
export function unusedAccountStep(state: UsageState, now: Date): 'warn30' | 'warn7' | 'delete' | null {
  const idle = daysSince(state.lastActive, now)
  if (idle < UNUSED_DELETE_DAYS - 30) return null
  if (!state.warned30At) return 'warn30'
  if (!state.warned7At) return idle >= UNUSED_DELETE_DAYS - 7 && daysSince(state.warned30At, now) >= 23 ? 'warn7' : null
  return idle >= UNUSED_DELETE_DAYS && daysSince(state.warned7At, now) >= 7 ? 'delete' : null
}
