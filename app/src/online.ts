import { ref } from 'vue'

/** Whether this device is online right now. */
export const online = ref(navigator.onLine)
addEventListener('online', () => (online.value = true))
addEventListener('offline', () => (online.value = false))

/** Changes need the internet. Returns true (and says so) when offline, so the caller stops. */
export function blockedOffline(): boolean {
  if (online.value) return false
  // imported lazily: this module loads before Pinia is ready
  void import('./stores/toasts').then(({ useToasts }) => useToasts().show('offline.blocked'))
  return true
}
