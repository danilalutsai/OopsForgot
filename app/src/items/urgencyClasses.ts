import type { Urgency } from '@oopsforgot/shared'

/** Background colour per urgency: row bars and calendar dots use the same palette. */
export const URGENCY_BG: Record<Urgency, string> = {
  red: 'bg-urgent-red',
  yellow: 'bg-urgent-yellow',
  green: 'bg-urgent-green',
  grey: 'bg-urgent-grey',
}
