import {
  type Category,
  currentDueDate,
  isHandled,
  type OpenQuestion,
  openQuestion,
  type Recurrence,
} from '@oopsproof/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '../supabase'

export interface Item {
  id: string
  name: string
  category: Category
  due_date: string
  due_time: string | null
  price_cents: number | null
  notes: string
  recurrence_unit: Recurrence['unit'] | null
  recurrence_every: number | null
  /** the Due date marked Handled, if any */
  handled_due_date: string | null
  archived_at: string | null
}

export type NewItem = Omit<Item, 'id' | 'handled_due_date' | 'archived_at'>

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
  'id, name, category, due_date, due_time, price_cents, notes, recurrence_unit, recurrence_every, handled_due_date, archived_at'

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

/** The question the Item is waiting on, if any ("What now?" / "Kept it?"). */
export function questionOf(item: Item, today: string, due?: string): OpenQuestion | null {
  // with `due` already worked out, Handled is a plain comparison
  if (due !== undefined && item.handled_due_date === due) return null
  return openQuestion(
    {
      dueDate: item.due_date,
      recurrence: recurrenceOf(item),
      handledDueDate: item.handled_due_date,
      category: item.category,
    },
    today,
  )
}
