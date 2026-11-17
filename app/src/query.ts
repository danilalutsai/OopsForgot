import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { persistQueryClient } from '@tanstack/query-persist-client-core'
import { QueryClient } from '@tanstack/vue-query'
import { del, get, set } from 'idb-keyval'

/** One cache for the whole app; emptied whenever the logged-in person changes. */
export const queryClient = new QueryClient({
  // keep data around for the saved offline copy; refetched whenever online
  defaultOptions: { queries: { gcTime: 1000 * 60 * 60 * 24 * 7 } },
})

// The saved copy for offline use lives in IndexedDB on this device.
const persister = createAsyncStoragePersister({
  storage: { getItem: (k) => get(k), setItem: (k, v) => set(k, v), removeItem: (k) => del(k) },
  key: 'oopsproof-offline-copy',
})

export const [, restored] = persistQueryClient({ queryClient, persister, maxAge: 1000 * 60 * 60 * 24 * 7 })

/** Removes the saved offline copy (on log out and account deletion). */
export async function wipeOfflineCopy() {
  queryClient.clear()
  await persister.removeClient()
  try {
    localStorage.removeItem(PROFILE_KEY)
  } catch {
    // nothing saved
  }
}

/** The person's profile is saved too, so dates and money stay right offline. */
export const PROFILE_KEY = 'oopsproof-profile'
