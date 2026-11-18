// For functions a logged-in person calls about their own account: who is asking, and proving
// it is really them (their password again, or a fresh Google sign-in when they have none).
import { createClient, type User } from 'npm:@supabase/supabase-js@2.119.0'

const env = (name: string) => Deno.env.get(name) ?? ''
const URL = env('SUPABASE_URL')
export const admin = createClient(URL, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
export const answer = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** The person asking, from their own session token; null when the token is no good. */
export async function caller(req: Request): Promise<{ user: User; token: string } | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^bearer\s+/i, '')
  const { data, error } = await admin.auth.getUser(token)
  return error || !data.user ? null : { user: data.user, token }
}

/** Whether the account has a password (a Google-only person may have added one: ask the account). */
export async function hasPassword(userId: string): Promise<boolean | 'busy'> {
  const { data, error } = await admin.rpc('account_has_password', { p_user: userId })
  return error ? 'busy' : data === true
}

/**
 * Checks the password on a separate client, so a stolen session alone proves nothing.
 * Only a wrong password is "wrong": rate limits or an outage must not tell people their password is bad.
 */
export async function checkPassword(email: string, password: unknown): Promise<'ok' | 'wrong' | 'busy'> {
  const check = createClient(URL, env('SUPABASE_ANON_KEY'), { auth: { persistSession: false } })
  const { error } = await check.auth.signInWithPassword({ email, password: String(password ?? '') })
  if (error) return (error as { code?: string }).code === 'invalid_credentials' ? 'wrong' : 'busy'
  // the check made a session of its own: end it
  await check.auth.signOut()
  return 'ok'
}

/** How fresh a sign-in must be to stand in for a password. */
const RECENT_SECONDS = 10 * 60

/**
 * Whether this session's sign-in (not a token renewal) happened in the last few minutes.
 * The token was already checked by getUser, so reading its claims is safe.
 */
export function signedInRecently(token: string): boolean {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')))
    // only a real sign-in counts, never a link from an email (someone may hold the inbox too)
    const latest = Math.max(
      ...(claims.amr ?? [])
        .filter((a: { method: string }) => a.method === 'oauth' || a.method === 'password')
        .map((a: { timestamp: number }) => a.timestamp),
    )
    return Date.now() / 1000 - latest < RECENT_SECONDS
  } catch {
    return false
  }
}
