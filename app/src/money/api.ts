import type { Category } from '@oopsproof/shared'
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

function useExpenseMutation<T>(write: (input: T) => PromiseLike<{ error: unknown }>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: T) => {
      const { error } = await write(input)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export const useAddExpense = () =>
  useExpenseMutation((e: ExpenseInput) =>
    supabase
      .from('expenses')
      .insert(e)
      .then((r) => r),
  )
export const useUpdateExpense = () =>
  useExpenseMutation(({ id, ...e }: ExpenseInput & { id: string }) =>
    supabase
      .from('expenses')
      .update(e)
      .eq('id', id)
      .then((r) => r),
  )
export const useDeleteExpense = () =>
  useExpenseMutation((id: string) =>
    supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .then((r) => r),
  )
