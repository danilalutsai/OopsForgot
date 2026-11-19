/// <reference lib="webworker" />
// The app's service worker: keeps the app files for fast loading and shows push Reminders.
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

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
  /** where tapping the message goes: an Item, or the dashboard */
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

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data as { url?: string })?.url ?? '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      // only windows this worker controls can be sent to another page
      const open = await self.clients.matchAll({ type: 'window' })
      const existing = open.find((c) => c.url.startsWith(self.location.origin)) as WindowClient | undefined
      if (existing) {
        try {
          await existing.focus()
          await existing.navigate(url)
          return
        } catch {
          // fall through to a new window
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
