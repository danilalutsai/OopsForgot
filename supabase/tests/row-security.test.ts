import { expect, it } from 'vitest'
import { query } from './db.ts'

it('every table people can reach has row level security switched on', async () => {
  const unprotected = await query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public' and not rowsecurity`,
  )
  expect(unprotected.map((t) => t.tablename)).toEqual([])
})

// Production exposes no table automatically, not even to the server: the server role's access
// is granted on purpose, for every table now and every table added later.
it('the server role can use every table, now and in later migrations', async () => {
  const missing = await query<{ tablename: string }>(
    `select c.relname as tablename from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
        and not has_table_privilege('service_role', c.oid, 'select, insert, update, delete')`,
  )
  expect(missing.map((t) => t.tablename)).toEqual([])
  const later = await query<{ granted: boolean }>(
    `select exists (
       select 1 from pg_default_acl d, aclexplode(d.defaclacl) a
        where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'r'
          and a.grantee = 'service_role'::regrole and a.privilege_type = 'SELECT'
     ) as granted`,
  )
  expect(later[0]?.granted).toBe(true)
})
