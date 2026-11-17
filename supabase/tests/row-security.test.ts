import { expect, it } from 'vitest'
import { query } from './db.ts'

it('every table people can reach has row level security switched on', async () => {
  const unprotected = await query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public' and not rowsecurity`,
  )
  expect(unprotected.map((t) => t.tablename)).toEqual([])
})
