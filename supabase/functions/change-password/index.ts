// Changes the caller's password. With a password: the current one must be typed. Google-only
// (adding a first password): a Google sign-in from the last few minutes is needed. So a stolen
// session alone can never set a password and take the account over.
import { admin, answer, caller, checkPassword, cors, hasPassword, signedInRecently } from '../_shared/caller.ts'

const MIN_LENGTH = 8

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return answer(405, { error: 'method' })

  const me = await caller(req)
  if (!me) return answer(401, { error: 'session' })
  const { current, password } = await req.json().catch(() => ({}))
  if (typeof password !== 'string' || password.length < MIN_LENGTH) return answer(400, { error: 'weak' })

  const withPassword = await hasPassword(me.user.id)
  if (withPassword === 'busy') return answer(503, { error: 'busy' })
  if (withPassword) {
    if (!me.user.email) return answer(403, { error: 'password' })
    const check = await checkPassword(me.user.email, current)
    if (check === 'wrong') return answer(403, { error: 'password' })
    if (check === 'busy') return answer(503, { error: 'busy' })
    if (current === password) return answer(400, { error: 'same' })
  } else if (!signedInRecently(me.token)) {
    return answer(403, { error: 'sign-in-again' })
  }

  const { error } = await admin.auth.admin.updateUserById(me.user.id, { password })
  if (error) {
    const code = (error as { code?: string }).code
    return code === 'weak_password' ? answer(400, { error: 'weak' }) : answer(503, { error: 'busy' })
  }
  return answer(200, { changed: true })
})
