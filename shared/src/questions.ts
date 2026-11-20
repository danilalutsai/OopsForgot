import type { Category } from './categories.ts'
import { type HandledItem, isHandled } from './handled.ts'
import { isExpired } from './due-date.ts'

/** The question an Item is waiting on: "What now?" for an Expired Item, "Kept it?" for a free trial that ended. */
export type OpenQuestion = 'expired' | 'keptTrial'

export interface QuestionItem extends HandledItem {
  category: Category
  finishTime?: string | null
  /** the Due date the person chose "Keep in Expired" (or "No, I cancelled") for: no more question about it */
  keptDueDate?: string | null
}

/** `now` is the person's local "YYYY-MM-DDTHH:MM" (or just the date). */
export function openQuestion(item: QuestionItem, now: string): OpenQuestion | null {
  const today = now.slice(0, 10)
  if (item.recurrence || isHandled(item, today) || item.keptDueDate === item.dueDate) return null
  if (item.category === 'free_trials' && item.dueDate <= today) return 'keptTrial'
  return isExpired(item, now) ? 'expired' : null
}

/** A kept trial becomes a Subscription named without "free trial" ("Disney+ free trial" → "Disney+"). */
export function keptTrialName(name: string): string {
  const cleaned = name
    .replace(/\(?\s*\bfree\s+trials?\b\s*\)?/gi, ' ')
    .replace(/^[\s\-–—:·]+|[\s\-–—:·]+$/g, '')
    .replace(/\s{2,}/g, ' ')
  return cleaned || name
}
