/// <reference lib="webworker" />
// The app's service worker: keeps the app files for fast loading and shows push Reminders.
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { rememberNotificationOpen, safePath } from './notificationOpen'

declare const self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
// any page of the app (/settings, /items/…) opens the app shell, also offline
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

interface PushMessage {
  title: string
  body?: string
  /** where tapping the message goes: that Event's details */
  url?: string
  /** messages with the same tag replace each other instead of piling up */
  tag?: string
}

self.addEventListener('push', (event) => {
  let message: PushMessage = { title: 'OopsForgot' }
  try {
    message = event.data?.json() ?? message
  } catch {
    // a push must always show something
    message = { title: 'OopsForgot', body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag: message.tag,
      data: { url: message.url ?? '/' },
    }),
  )
})

// Tapping a Reminder opens that Event's details, whether the app is open, asleep in the
// background or not running at all.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = safePath((event.notification.data as { url?: string })?.url) ?? '/'
  event.waitUntil(
    (async () => {
      // for an app this tap starts, or one that reloads on the way: it goes on to the Event
      await rememberNotificationOpen(path).catch(() => {})
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = open.find((c) => c.url.startsWith(self.location.origin)) as WindowClient | undefined
      if (existing) {
        // the open app goes there itself: no reload, and it works where navigate() doesn't (iPhone)
        existing.postMessage({ type: 'open', path })
        try {
          await existing.focus()
          return
        } catch {
          // couldn't bring it forward: open a window instead
        }
      }
      await self.clients.openWindow(new URL(path, self.location.origin).href)
    })(),
  )
})
