import { useQueryClient } from '@tanstack/vue-query'
import { supabase } from '../supabase'
import { useToasts } from '../stores/toasts'
import { type Item, useDeleteItem, useRestoreDeletedItem, useUpdateItem } from './api'

/** Items with a Handled change still on its way; more taps on them wait. */
const pendingHandled = new Set<string>()

/** Handled, Archive, Restore and Delete, each with its message and (where it helps) Undo. */
export function useItemActions() {
  const update = useUpdateItem()
  const remove = useDeleteItem()
  const putBack = useRestoreDeletedItem()
  const toasts = useToasts()
  const queryClient = useQueryClient()

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action()
      return true
    } catch {
      toasts.show('toasts.failed')
      return false
    }
  }

  /** Shows a change on screen at once; the refetch after saving confirms or corrects it. */
  function showNow(id: string, changes: Partial<Item>) {
    queryClient.setQueryData<Item[]>(['items'], (items) => items?.map((i) => (i.id === id ? { ...i, ...changes } : i)))
  }

  async function setHandledFor(item: Item, handled_due_date: string | null) {
    showNow(item.id, { handled_due_date })
    if (!(await run(() => update.mutateAsync({ id: item.id, handled_due_date })))) {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      return false
    }
    return true
  }

  return {
    /** Flips Handled for the Due date the Item is on now (`due`). */
    async toggleHandled(item: Item, due: string) {
      if (pendingHandled.has(item.id)) return
      pendingHandled.add(item.id)
      const before = item.handled_due_date
      const next = before === due ? null : due
      try {
        if (!(await setHandledFor(item, next))) return
      } finally {
        pendingHandled.delete(item.id)
      }
      toasts.show(next ? 'toasts.handled' : 'toasts.unhandled', {}, () => setHandledFor(item, before))
    },
    /** Returns false when archiving failed, so a swiped row can slide back. */
    async archive(item: Item): Promise<boolean> {
      if (!(await run(() => update.mutateAsync({ id: item.id, archived_at: new Date().toISOString() })))) return false
      toasts.show('toasts.archived', { name: item.name }, () =>
        run(() => update.mutateAsync({ id: item.id, archived_at: null })),
      )
      return true
    },
    async restore(item: Item) {
      if (await run(() => update.mutateAsync({ id: item.id, archived_at: null }))) toasts.show('items.restored')
    },
    async delete(item: Item) {
      // The full row, including when it was added, so Undo brings it back exactly.
      // Rows in other tables that belong to the Item (Reminders, Expenses) must be copied here too once they exist.
      const { data: copy, error } = await supabase.from('items').select('*').eq('id', item.id).single()
      if (error || !copy) return toasts.show('toasts.failed')
      if (!(await run(() => remove.mutateAsync(item.id)))) return
      toasts.show('toasts.deleted', { name: item.name }, () => run(() => putBack.mutateAsync(copy)))
    },
  }
}
