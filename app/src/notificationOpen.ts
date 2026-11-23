import { del, get, set } from 'idb-keyval'

/**
 * Tapping a Reminder opens that Event's details. The service worker tells an open app where to go;
 * it also leaves the place here for a moment, for an app the tap starts (the iPhone may start it
 * at its first page, not at the Reminder's link), or one that reloads on the way.
 */
const KEY = 'oopsforgot.openFromNotification'
/** A tap older than this is not what the person is opening the app for. */
const FRESH_MS = 60_000

export interface NotificationOpen {
  path: string
  at: number
}

/** Only places inside the app, like "/?item=<id>". */
export function safePath(path: unknown): string | null {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : null
}

/** Where a remembered tap still leads, or null when there is none or it is too old. */
export function pendingPath(saved: NotificationOpen | undefined, now: number): string | null {
  if (!saved || now - saved.at > FRESH_MS || saved.at > now + FRESH_MS) return null
  return safePath(saved.path)
}

/** Called by the service worker as the Reminder is tapped. */
export const rememberNotificationOpen = (path: string) => set(KEY, { path, at: Date.now() } satisfies NotificationOpen)

/** Called by the app: where to go for a tap just made, if any. Each tap is used once. */
export async function takeNotificationOpen(): Promise<string | null> {
  try {
    const saved = await get<NotificationOpen>(KEY)
    if (saved) await del(KEY)
    return pendingPath(saved, Date.now())
  } catch {
    // no storage: the Reminder's link still opens the Event
    return null
  }
}
