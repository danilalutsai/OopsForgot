import { currentDueDate, type DatedItem } from './due-date.ts'

export interface HandledItem extends DatedItem {
  /** The Due date the person marked Handled, if any. */
  handledDueDate: string | null
}

/** Handled counts only for the Due date it was given for; a repeating Item's next Due date starts fresh. */
export function isHandled(item: HandledItem, today: string): boolean {
  return item.handledDueDate !== null && item.handledDueDate === currentDueDate(item, today)
}
