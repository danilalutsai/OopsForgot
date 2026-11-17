import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'

// deno-lint-ignore no-explicit-any
export type Row = Record<string, any>

/** Every row of a table, read page by page (the API gives at most 1000 at a time) before anything changes. */
export async function allRows<T extends Row>(db: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const rows: T[] = []
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .order('id')
      .range(start, start + 999)
    if (error) throw error
    rows.push(...(data as unknown as T[]))
    if (data.length < 1000) return rows
  }
}
