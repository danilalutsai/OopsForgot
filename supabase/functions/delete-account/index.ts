// Deletes the caller's account at once and for good: their password is checked again first.
// Items, Reminders, Expenses, push devices and the Calendar feed go with the account (the
// database cascades from it); the profile photo is removed from storage; the ID is kept in
// deleted_accounts so a restored backup can be cleaned again.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const env = (name: string) => Deno.env.get(name) ?? ''
const URL = env('SUPABASE_URL')
const admin = createClient(URL, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const answer = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return answer(405, { error: 'method' })

  // who is asking: their own session token
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? ''
  const { data: me, error: who } = await admin.auth.getUser(token)
  if (who || !me.user?.email) return answer(401, { error: 'session' })

  // they type their password again: a stolen session alone can't delete the account
  const { password, confirm } = await req.json().catch(() => ({}))
  if (confirm !== 'DELETE') return answer(400, { error: 'confirm' })
  const check = createClient(URL, env('SUPABASE_ANON_KEY'), { auth: { persistSession: false } })
  const { error: wrong } = await check.auth.signInWithPassword({
    email: me.user.email,
    password: String(password ?? ''),
  })
  if (wrong) return answer(403, { error: 'password' })

  const id = me.user.id
  const { error: noted } = await admin.from('deleted_accounts').upsert({ user_id: id })
  if (noted) return answer(500, { error: 'failed' })

  const { data: photos } = await admin.storage.from('avatars').list(id)
  if (photos?.length) await admin.storage.from('avatars').remove(photos.map((p) => `${id}/${p.name}`))

  const { error: gone } = await admin.auth.admin.deleteUser(id)
  if (gone) return answer(500, { error: 'failed' })
  return answer(200, { deleted: true })
})
