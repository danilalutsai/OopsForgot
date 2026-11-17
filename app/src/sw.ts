/// <reference lib="webworker" />
// The app's service worker: keeps the app files for fast loading and shows push Reminders.
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

interface PushMessage {
  title: string
  body?: string
  /** where tapping the message goes: an Item, or the dashboard */
  url?: string
  /** messages with the same tag replace each other instead of piling up */
  tag?: string
}

self.addEventListener('push', (event) => {
  const message: PushMessage = event.data?.json() ?? { title: 'OopsProof' }
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
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = open.find((c) => c.url.startsWith(self.location.origin)) as WindowClient | undefined
      if (existing) {
        await existing.focus()
        return existing.navigate(url)
      }
      return self.clients.openWindow(url)
    })(),
  )
})
