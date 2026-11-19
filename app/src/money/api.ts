import type { Category } from '@oopsforgot/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '../supabase'

export interface Expense {
  id: string
  amount_cents: number
  category: Category
  date: string
  description: string
  item_id: string | null
  item_name: string | null
}

export type ExpenseInput = Pick<Expense, 'amount_cents' | 'category' | 'date' | 'description'>

/** All of the person's Expenses: the Money tab moves between months and works offline from this copy. */
export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, amount_cents, category, date, description, item_id, item_name')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Expense[]
    },
  })
}

/** No row back means the Expense is gone or not this person's: nothing was changed. */
function changedOne(data: unknown[] | null) {
  if (!data?.length) throw new Error('Expense not found')
}

export function useAddExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ExpenseInput) => {
      const { error } = await supabase.from('expenses').insert(input)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: ExpenseInput & { id: string }) => {
      const { data, error } = await supabase.from('expenses').update(input).eq('id', id).select('id')
      if (error) throw error
      changedOne(data)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('expenses').delete().eq('id', id).select('id')
      if (error) throw error
      changedOne(data)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })
}
