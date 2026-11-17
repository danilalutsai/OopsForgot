import { supabase } from '../supabase'

/** Removes this browser from the logged-in person's push devices and stops its subscription. */
export async function forgetThisDevice() {
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    await supabase.from('push_devices').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  } catch {
    // logging out must never fail because of push
  }
}
