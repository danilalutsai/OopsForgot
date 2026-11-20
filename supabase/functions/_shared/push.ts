// Sending one web push, shared by the Reminder sender and the test notification.
import * as webpush from 'npm:web-push@4.0.0'

const env = (name: string) => Deno.env.get(name) ?? ''
/** Local test switch: a fake push service that only reports what it would send. */
export const testing = env('REMINDERS_TEST_MODE') === '1'

/**
 * Why push can't be used, if it can't (a missing or mistyped key). Functions still start, so they
 * keep refusing strangers and say plainly what is wrong instead of failing on every request.
 */
export let pushProblem: string | null = null
if (!testing) {
  try {
    webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
  } catch (e) {
    // web-push says what is wrong (say, a key's length), never the key itself
    pushProblem = e instanceof Error ? e.message : String(e)
    console.error('Push is not set up:', pushProblem)
  }
}

export interface Device {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export type Outcome = 'delivered' | 'gone' | 'failed'

export async function send(device: Device, payload: string): Promise<Outcome> {
  if (testing) return 'delivered'
  try {
    await webpush.sendNotification(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      payload,
      { TTL: 60 * 60 * 24, urgency: 'high' },
    )
    return 'delivered'
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode
    // 404/410: the subscription is gone for good; anything else may work next time
    return status === 404 || status === 410 ? 'gone' : 'failed'
  }
}
