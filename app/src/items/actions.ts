import { addMonths, keptTrialName } from '@oopsproof/shared'
import { useQueryClient } from '@tanstack/vue-query'
import { blockedOffline } from '../online'
import { supabase } from '../supabase'
import { fittingOrDefault } from './reminderFit'
import { useToasts } from '../stores/toasts'
import { type Item, recurrenceOf, useDeleteItem, useRestoreDeletedItem, useUpdateItem } from './api'

/** Handled changes per Item run one after another, so quick taps toggle in order instead of racing. */
const handledQueue = new Map<string, Promise<unknown>>()

/** Handled, Archive, Restore and Delete, each with its message and (where it helps) Undo. */
export function useItemActions() {
  const update = useUpdateItem()
  const remove = useDeleteItem()
  const putBack = useRestoreDeletedItem()
  const toasts = useToasts()
  const queryClient = useQueryClient()

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    if (blockedOffline()) return false
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

  /** Saves Handled without touching the screen; a failure puts the server's state back on screen. */
  async function saveHandled(item: Item, handled_due_date: string | null) {
    const saved = await run(async () => {
      const { data, error } = await supabase.from('items').update({ handled_due_date }).eq('id', item.id).select('id')
      if (error || !data?.length) throw error ?? new Error('Item not found')
    })
    if (!saved) void queryClient.invalidateQueries({ queryKey: ['items'] })
    return saved
  }

  /** Flips Handled on screen at once and saves it behind any earlier change to the same Item. */
  function queueHandled(item: Item, next: string | null, then?: () => void) {
    if (blockedOffline()) return Promise.resolve()
    showNow(item.id, { handled_due_date: next })
    const step = (handledQueue.get(item.id) ?? Promise.resolve()).then(async () => {
      if (await saveHandled(item, next)) then?.()
    })
    handledQueue.set(item.id, step)
    return step.finally(() => {
      if (handledQueue.get(item.id) !== step) return
      handledQueue.delete(item.id)
      // only now, with nothing left in flight, check the screen against the server
      void queryClient.invalidateQueries({ queryKey: ['items'] })
    })
  }

  return {
    /** Flips Handled for the Due date the Item is on now (`due`). */
    async toggleHandled(item: Item, due: string) {
      // decided from what is on screen now, which already includes earlier taps
      const before = (queryClient.getQueryData<Item[]>(['items'])?.find((i) => i.id === item.id) ?? item)
        .handled_due_date
      const next = before === due ? null : due
      await queueHandled(item, next, () =>
        toasts.show(next ? 'toasts.handled' : 'toasts.unhandled', {}, () => queueHandled(item, before)),
      )
    },
    /** Returns false when archiving failed, so a swiped row can slide back. */
    async archive(item: Item): Promise<boolean> {
      if (!(await run(() => update.mutateAsync({ id: item.id, archived_at: new Date().toISOString() })))) return false
      toasts.show('toasts.archived', { name: item.name }, () =>
        run(() => update.mutateAsync({ id: item.id, archived_at: null })),
      )
      return true
    },
    /** Answers "What now?" with a new Due date. */
    async setNewDueDate(item: Item, dueDate: string) {
      if (!dueDate) return
      const reminder_offsets = fittingOrDefault(item.reminder_offsets, {
        dueDate,
        dueTime: item.due_time,
        recurrence: recurrenceOf(item),
      })
      if (
        await run(() =>
          update.mutateAsync({ id: item.id, due_date: dueDate, handled_due_date: null, reminder_offsets }),
        )
      )
        toasts.show('settings.saved')
    },
    /** Answers "What now?" by repeating; the next Due date is counted forward from the old one. */
    async makeRepeat(item: Item, unit: 'week' | 'month' | 'year') {
      const reminder_offsets = fittingOrDefault(item.reminder_offsets, {
        dueDate: item.due_date,
        dueTime: item.due_time,
        recurrence: { unit, every: 1 },
      })
      if (
        await run(() =>
          update.mutateAsync({ id: item.id, recurrence_unit: unit, recurrence_every: 1, reminder_offsets }),
        )
      )
        toasts.show('settings.saved')
    },
    /** Answers "Kept it?" with Yes: a monthly Subscription from one month after the trial ended. */
    async keepTrial(item: Item) {
      const name = keptTrialName(item.name)
      const reminders = fittingOrDefault(item.reminder_offsets, {
        dueDate: addMonths(item.due_date, 1),
        dueTime: item.due_time,
        recurrence: { unit: 'month', every: 1 },
      })
      // one step on the server: the Subscription and its first charge on the trial's Due date
      const kept = await run(async () => {
        const { error } = await supabase.rpc('keep_trial', { p_item_id: item.id, p_name: name, p_reminders: reminders })
        if (error) throw error
      })
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
      if (kept) toasts.show('questions.kept', { name })
    },
    async restore(item: Item) {
      if (await run(() => update.mutateAsync({ id: item.id, archived_at: null }))) toasts.show('items.restored')
    },
    async delete(item: Item) {
      if (blockedOffline()) return
      // The full row (Reminders included, as they live on it) and when it was added, so Undo brings it back exactly.
      // Rows in other tables that belong to the Item (Expenses) must be copied here too once they exist.
      const { data: copy, error } = await supabase.from('items').select('*').eq('id', item.id).single()
      if (error || !copy) return toasts.show('toasts.failed')
      if (!(await run(() => remove.mutateAsync(item.id)))) return
      toasts.show('toasts.deleted', { name: item.name }, () => run(() => putBack.mutateAsync(copy)))
    },
  }
}
