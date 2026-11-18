// Deletes the caller's account at once and for good: their password is checked again first (or,
// with no password, a Google sign-in from the last few minutes is needed).
// Items, Reminders, Expenses, push devices and the Calendar feed go with the account (the
// database cascades from it); the profile photo is removed from storage; the ID is kept in
// deleted_accounts so a restored backup can be cleaned again.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { deleteAccount } from '../_shared/deleteAccount.ts'

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

/** How fresh a sign-in must be to delete an account that has no password. */
const RECENT_SECONDS = 10 * 60

/**
 * Whether this session's sign-in (not a token renewal) happened in the last few minutes.
 * The token was already checked by getUser, so reading its claims is safe.
 */
function signedInRecently(token: string): boolean {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')))
    const latest = Math.max(...(claims.amr ?? []).map((a: { timestamp: number }) => a.timestamp))
    return Date.now() / 1000 - latest < RECENT_SECONDS
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return answer(405, { error: 'method' })

  // who is asking: their own session token
  const token = (req.headers.get('Authorization') ?? '').replace(/^bearer\s+/i, '')
  const { data: me, error: who } = await admin.auth.getUser(token)
  if (who || !me.user) return answer(401, { error: 'session' })
  const { password, confirm } = await req.json().catch(() => ({}))
  if (confirm !== 'DELETE') return answer(400, { error: 'confirm' })

  const hasPassword = (me.user.identities ?? []).some((i) => i.provider === 'email')
  if (hasPassword && me.user.email) {
    // they type their password again: a stolen session alone can't delete the account
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
  } else if (!signedInRecently(token)) {
    // no password to type (Google only): they must have just signed in with Google again
    return answer(403, { error: 'sign-in-again' })
  }

  const outcome = await deleteAccount(admin, me.user.id)
  if (outcome === 'busy') return answer(503, { error: 'busy' })
  if (outcome === 'failed') return answer(500, { error: 'failed' })
  return answer(200, { deleted: true })
})
