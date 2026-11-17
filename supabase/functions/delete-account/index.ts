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
  const token = (req.headers.get('Authorization') ?? '').replace(/^bearer\s+/i, '')
  const { data: me, error: who } = await admin.auth.getUser(token)
  if (who || !me.user) return answer(401, { error: 'session' })
  if (!me.user.email) return answer(400, { error: 'no-password' })

  // they type their password again: a stolen session alone can't delete the account
  const { password, confirm } = await req.json().catch(() => ({}))
  if (confirm !== 'DELETE') return answer(400, { error: 'confirm' })
  const check = createClient(URL, env('SUPABASE_ANON_KEY'), { auth: { persistSession: false } })
  const { error: wrong } = await check.auth.signInWithPassword({
    email: me.user.email,
    password: String(password ?? ''),
  })
  if (wrong) {
    // only a wrong password is "wrong"; rate limits or an outage must not tell people their password is bad
    const code = (wrong as { code?: string }).code
    return code === 'invalid_credentials' ? answer(403, { error: 'password' }) : answer(503, { error: 'busy' })
  }
  // the check made a session of its own: end it
  await check.auth.signOut()

  const id = me.user.id
  // Photos are listed before anything changes, so a storage problem stops the deletion cleanly.
  const { data: photos, error: listing } = await admin.storage.from('avatars').list(id)
  if (listing) return answer(503, { error: 'busy' })

  // The account itself goes first; everything after only happens once it really is gone.
  const { error: gone } = await admin.auth.admin.deleteUser(id)
  if (gone) return answer(500, { error: 'failed' })

  // Now (and only now) the ID joins the deleted list, for cleaning a restored backup.
  await admin.from('deleted_accounts').upsert({ user_id: id })
  if (photos?.length) {
    const names = photos.map((p) => `${id}/${p.name}`)
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await admin.storage.from('avatars').remove(names)
      if (!error) break
      if (attempt === 2) console.error(`Photo of deleted account ${id} left in storage`, error)
    }
  }
  return answer(200, { deleted: true })
})
