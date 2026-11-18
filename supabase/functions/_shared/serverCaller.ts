// For functions only the server may call (the cron jobs). The cron sends the server key it keeps
// in Vault; Supabase has two forms of that key (the older JWT one and the newer "sb_secret_" one),
// and the function may hold the other form. Either is accepted, nothing else.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const env = (name: string) => Deno.env.get(name) ?? ''
const URL = env('SUPABASE_URL')
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')

/** Keys already proven to be server keys, so each cron run costs no extra check. */
const proven = new Set<string>()

export async function isServerCaller(req: Request): Promise<boolean> {
  const key = (req.headers.get('Authorization') ?? '').replace(/^bearer\s+/i, '')
  if (!key) return false
  if (key === SERVICE_KEY || proven.has(key)) return true
  // only a real server key may list accounts; any other key is refused there
  const probe = createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await probe.auth.admin.listUsers({ page: 1, perPage: 1 })
  if (error) return false
  proven.add(key)
  return true
}
