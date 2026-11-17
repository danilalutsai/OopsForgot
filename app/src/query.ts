import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { persistQueryClient } from '@tanstack/query-persist-client-core'
import { QueryClient } from '@tanstack/vue-query'
import { del, get, set } from 'idb-keyval'

/** One cache for the whole app; emptied whenever the logged-in person changes. */
export const queryClient = new QueryClient({
  defaultOptions: {
    // keep data around for the saved offline copy; refetched whenever online
    queries: { gcTime: 1000 * 60 * 60 * 24 * 7 },
    // changes are refused offline (blockedOffline), never parked to fire later by surprise
    mutations: { networkMode: 'always' },
  },
})

// The saved copy for offline use lives in IndexedDB on this device, for one person at a time.
const persister = createAsyncStoragePersister({
  storage: { getItem: (k) => get(k), setItem: (k, v) => set(k, v), removeItem: (k) => del(k) },
  key: 'oopsproof-offline-copy',
})
const OWNER_KEY = 'oopsproof-offline-owner'

const [, restore] = persistQueryClient({ queryClient, persister, maxAge: 1000 * 60 * 60 * 24 * 7 })
/** Resolves once the saved copy (if any) is back in the cache. */
export const restored = restore.catch(() => undefined)

/** Removes the saved offline copy from this device. */
export async function wipeOfflineCopy() {
  await restored
  queryClient.clear()
  await persister.removeClient()
  try {
    localStorage.removeItem(OWNER_KEY)
  } catch {
    // nothing saved
  }
}

/** Makes sure the saved copy belongs to `userId` (or to nobody): anyone else's is wiped first. */
export async function keepOfflineCopyFor(userId: string | null) {
  let owner: string | null = null
  try {
    owner = localStorage.getItem(OWNER_KEY)
  } catch {
    // treat as unknown
  }
  if (owner === userId && userId !== null) return
  await wipeOfflineCopy()
  if (userId) {
    try {
      localStorage.setItem(OWNER_KEY, userId)
    } catch {
      // the copy just won't be trusted next start
    }
  }
}
