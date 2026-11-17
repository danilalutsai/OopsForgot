import { useToasts } from '../stores/toasts'
import { type Item, useDeleteItem, useRestoreDeletedItem, useUpdateItem } from './api'

/** Handled, Archive, Restore and Delete, each with its message and (where it helps) Undo. */
export function useItemActions() {
  const update = useUpdateItem()
  const remove = useDeleteItem()
  const putBack = useRestoreDeletedItem()
  const toasts = useToasts()

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action()
      return true
    } catch {
      toasts.show('toasts.failed')
      return false
    }
  }

  return {
    /** Marks the Item Handled for `due` (the Due date it is on now), or clears it with `null`. */
    async setHandled(item: Item, due: string | null) {
      const before = item.handled_due_date
      if (!(await run(() => update.mutateAsync({ id: item.id, handled_due_date: due })))) return
      toasts.show(due ? 'toasts.handled' : 'toasts.unhandled', {}, () =>
        run(() => update.mutateAsync({ id: item.id, handled_due_date: before })),
      )
    },
    async archive(item: Item) {
      if (!(await run(() => update.mutateAsync({ id: item.id, archived_at: new Date().toISOString() })))) return
      toasts.show('toasts.archived', { name: item.name }, () =>
        run(() => update.mutateAsync({ id: item.id, archived_at: null })),
      )
    },
    async restore(item: Item) {
      if (await run(() => update.mutateAsync({ id: item.id, archived_at: null }))) toasts.show('items.restored')
    },
    async delete(item: Item) {
      const copy = { ...item }
      if (!(await run(() => remove.mutateAsync(item.id)))) return
      toasts.show('toasts.deleted', { name: item.name }, () => run(() => putBack.mutateAsync(copy)))
    },
  }
}
