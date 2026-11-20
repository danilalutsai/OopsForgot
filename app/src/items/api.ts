import {
  type Category,
  currentDueDate,
  isExpired,
  isHandled,
  type OpenQuestion,
  openQuestion,
  type Recurrence,
  type ReminderOffset,
} from '@oopsforgot/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '../supabase'

export interface Item {
  id: string
  name: string
  category: Category
  due_date: string
  /** Start time; none means all day */
  due_time: string | null
  /** when it ends, later than the Start time on the same day */
  finish_time: string | null
  price_cents: number | null
  notes: string
  recurrence_unit: Recurrence['unit'] | null
  recurrence_every: number | null
  /** the Due date marked Handled, if any */
  handled_due_date: string | null
  /** the Due date the person chose "Keep in Expired" for: no question about it any more */
  kept_expired_due_date: string | null
  reminder_offsets: ReminderOffset[]
}

export type NewItem = Omit<Item, 'id' | 'handled_due_date' | 'kept_expired_due_date'>

export function recurrenceOf(item: Pick<Item, 'recurrence_unit' | 'recurrence_every'>): Recurrence | null {
  return item.recurrence_unit && item.recurrence_every
    ? { unit: item.recurrence_unit, every: item.recurrence_every }
    : null
}

/** Handled for the Due date it is on now; pass `due` when it is already worked out. */
export function handledNow(item: Item, today: string, due?: string): boolean {
  if (due !== undefined) return item.handled_due_date === due
  return isHandled(
    { dueDate: item.due_date, recurrence: recurrenceOf(item), handledDueDate: item.handled_due_date },
    today,
  )
}

/** The Due date the Item is on today: a repeating Item has moved on past its first one. */
export function dueDateOf(item: Item, today: string): string {
  return currentDueDate({ dueDate: item.due_date, recurrence: recurrenceOf(item) }, today)
}

const COLUMNS =
  'id, name, category, due_date, due_time, finish_time, price_cents, notes, recurrence_unit, recurrence_every, handled_due_date, kept_expired_due_date, reminder_offsets'

/** Unordered: the dashboard sorts by each Item's current Due date. */
export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('items').select(COLUMNS)
      if (error) throw error
      return data as Item[]
    },
  })
}

export function useAddItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (item: NewItem) => {
      const { error } = await supabase.from('items').insert(item)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  })
}

export function useUpdateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...changes }: Partial<Omit<Item, 'id'>> & { id: string }) => {
      const { data, error } = await supabase.from('items').update(changes).eq('id', id).select('id')
      if (error) throw error
      // No row back means the Item is gone or not this person's: nothing was saved.
      if (!data?.length) throw new Error('Item not found')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  })
}

/** Puts a just-deleted Item back exactly as it was (Undo). */
export function useRestoreDeletedItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (item: Item & { created_at?: string }) => {
      const { error } = await supabase.from('items').insert(item)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  })
}

/**
 * The question the Item is waiting on, if any ("What now?" / "Kept it?").
 * `now` is the person's local "YYYY-MM-DDTHH:MM" (a Finish time can make it Expired today).
 */
export function questionOf(item: Item, now: string, due?: string): OpenQuestion | null {
  // with `due` already worked out, Handled is a plain comparison
  if (due !== undefined && item.handled_due_date === due) return null
  return openQuestion(
    {
      dueDate: item.due_date,
      recurrence: recurrenceOf(item),
      handledDueDate: item.handled_due_date,
      category: item.category,
      finishTime: item.finish_time,
      keptDueDate: item.kept_expired_due_date,
    },
    now,
  )
}

/** Expired now: one-time, and past its Finish time, or past its Due date for all-day Items. */
export function expiredNow(item: Item, now: string): boolean {
  return isExpired({ dueDate: item.due_date, recurrence: recurrenceOf(item), finishTime: item.finish_time }, now)
}
