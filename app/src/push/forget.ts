import { supabase } from '../supabase'

async function thisSubscription() {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/**
 * Stops this browser getting push. Unsubscribing makes the subscription dead at the push service,
 * so even a row the server still holds can't deliver here (the Reminder sender drops dead ones).
 */
export async function unsubscribeThisBrowser() {
  try {
    await (await thisSubscription())?.unsubscribe()
  } catch {
    // never block what called this
  }
}

/** On log out: remove this browser from the person's devices (giving up after 2 s), then unsubscribe it. */
export async function forgetThisDevice() {
  try {
    const sub = await thisSubscription()
    if (!sub) return
    await Promise.race([
      supabase.from('push_devices').delete().eq('endpoint', sub.endpoint),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ])
  } catch {
    // logging out must never fail or hang because of push
  }
  await unsubscribeThisBrowser()
}
