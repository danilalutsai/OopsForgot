// "Send a test notification": one push, right away, to the caller's own device that asked (never to
// their other devices or anyone else's), at most once a minute per device.
import { admin, answer, caller, cors } from '../_shared/caller.ts'
import { pushProblem, send } from '../_shared/push.ts'

const MINUTE = 60_000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return answer(405, { error: 'method' })

  const me = await caller(req)
  if (!me) return answer(401, { error: 'session' })
  if (pushProblem) return answer(503, { error: 'notSetUp' })
  const { endpoint } = await req.json().catch(() => ({}))
  if (typeof endpoint !== 'string' || !endpoint) return answer(400, { error: 'device' })

  // takes the minute's turn in one step, so two quick taps can't both send
  const since = new Date(Date.now() - MINUTE).toISOString()
  const { data: taken, error } = await admin
    .from('push_devices')
    .update({ last_test_at: new Date().toISOString() })
    .eq('user_id', me.user.id)
    .eq('endpoint', endpoint)
    .or(`last_test_at.is.null,last_test_at.lt.${since}`)
    .select('id, user_id, endpoint, p256dh, auth')
  if (error) return answer(503, { error: 'busy' })
  if (!taken.length) {
    const { data: mine } = await admin
      .from('push_devices')
      .select('id')
      .eq('user_id', me.user.id)
      .eq('endpoint', endpoint)
    return mine?.length ? answer(429, { error: 'tooSoon' }) : answer(404, { error: 'device' })
  }

  const device = taken[0]!
  const outcome = await send(
    device,
    JSON.stringify({
      title: 'Test notification',
      body: 'This device will get your Reminders.',
      url: '/settings',
      // its own tag: it never replaces a Reminder still on the phone
      tag: `test-${Date.now()}`,
    }),
  )
  if (outcome === 'gone') {
    await admin.from('push_devices').delete().eq('id', device.id)
    return answer(410, { error: 'gone' })
  }
  if (outcome === 'failed') {
    // nothing went out: the person may try again at once
    await admin.from('push_devices').update({ last_test_at: null }).eq('id', device.id)
    return answer(502, { error: 'failed' })
  }
  return answer(200, { sent: true })
})
