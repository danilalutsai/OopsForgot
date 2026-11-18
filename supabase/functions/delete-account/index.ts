// Deletes the caller's account at once and for good: their password is checked again first (or,
// with no password, a Google sign-in from the last few minutes is needed).
// Items, Reminders, Expenses, push devices and the Calendar feed go with the account (the
// database cascades from it); the profile photo is removed from storage; the ID is kept in
// deleted_accounts so a restored backup can be cleaned again.
import { admin, answer, caller, checkPassword, cors, hasPassword, signedInRecently } from '../_shared/caller.ts'
import { deleteAccount } from '../_shared/deleteAccount.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return answer(405, { error: 'method' })

  const me = await caller(req)
  if (!me) return answer(401, { error: 'session' })
  const { password, confirm } = await req.json().catch(() => ({}))
  if (confirm !== 'DELETE') return answer(400, { error: 'confirm' })

  // someone who never confirmed 16+ has nothing saved yet: their signup goes at once
  const { data: profile } = await admin
    .from('profiles')
    .select('confirmed_16_plus_at')
    .eq('id', me.user.id)
    .maybeSingle()
  const unconfirmed = profile !== null && profile.confirmed_16_plus_at === null

  if (!unconfirmed) {
    const withPassword = await hasPassword(me.user.id)
    if (withPassword === 'busy') return answer(503, { error: 'busy' })
    if (withPassword && me.user.email) {
      const check = await checkPassword(me.user.email, password)
      if (check === 'wrong') return answer(403, { error: 'password' })
      if (check === 'busy') return answer(503, { error: 'busy' })
    } else if (!signedInRecently(me.token)) {
      // no password to type (Google only): they must have just signed in with Google again
      return answer(403, { error: 'sign-in-again' })
    }
  }

  const outcome = await deleteAccount(admin, me.user.id)
  if (outcome === 'busy') return answer(503, { error: 'busy' })
  if (outcome === 'failed') return answer(500, { error: 'failed' })
  return answer(200, { deleted: true })
})
