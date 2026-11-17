import type { Category } from './categories.ts'
import { type HandledItem, isHandled } from './handled.ts'
import { isExpired } from './due-date.ts'

/** The question an Item is waiting on: "What now?" for an Expired Item, "Kept it?" for a free trial that ended. */
export type OpenQuestion = 'expired' | 'keptTrial'

export interface QuestionItem extends HandledItem {
  category: Category
}

export function openQuestion(item: QuestionItem, today: string): OpenQuestion | null {
  if (item.recurrence || isHandled(item, today)) return null
  if (item.category === 'free_trials' && item.dueDate <= today) return 'keptTrial'
  return isExpired(item, today) ? 'expired' : null
}

/** A kept trial becomes a Subscription named without "free trial" ("Disney+ free trial" → "Disney+"). */
export function keptTrialName(name: string): string {
  const cleaned = name
    .replace(/\(?\s*free\s+trial\s*\)?/gi, ' ')
    .replace(/^[\s\-–—:·]+|[\s\-–—:·]+$/g, '')
    .replace(/\s{2,}/g, ' ')
  return cleaned || name
}
