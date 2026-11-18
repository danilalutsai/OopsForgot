// Logs the caller out on every device and stops Reminders reaching any of them, in one go:
// sessions end first, then the devices are removed (so a failure never leaves the person
// logged in everywhere with Reminders silently stopped).
import { admin, answer, caller, cors } from '../_shared/caller.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return answer(405, { error: 'method' })

  const me = await caller(req)
  if (!me) return answer(401, { error: 'session' })

  const { error: signOut } = await admin.auth.admin.signOut(me.token, 'global')
  if (signOut) return answer(503, { error: 'busy' })
  const { error: devices } = await admin.from('push_devices').delete().eq('user_id', me.user.id)
  if (devices) return answer(503, { error: 'busy' })
  return answer(200, { done: true })
})
