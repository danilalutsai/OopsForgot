/** The day Reminder time people get unless they choose another. */
export const DEFAULT_DAY_REMINDER_TIME = '12:00'

/** Day Reminders go out in 15-minute steps, so a chosen time is rounded down ("03:07" → "03:00"). */
export function roundToQuarterHour(time: string): string {
  const [h = '00', m = '00'] = time.split(':')
  return `${h.padStart(2, '0')}:${String(Math.floor(Number(m) / 15) * 15).padStart(2, '0')}`
}
