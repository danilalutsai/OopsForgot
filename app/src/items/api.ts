import type { Category } from '@oopsproof/shared'
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
}

export type NewItem = Omit<Item, 'id'>

const COLUMNS = 'id, name, category, due_date, due_time, price_cents, notes'

export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('items').select(COLUMNS).order('due_date').order('due_time')
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
