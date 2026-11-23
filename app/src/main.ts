import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { startAppUpdates } from './appUpdate'
import { i18n } from './i18n'
import { safePath, takeNotificationOpen } from './notificationOpen'
import { queryClient } from './query'
import { router } from './router'
import './style.css'

createApp(App).use(createPinia()).use(router).use(VueQueryPlugin, { queryClient }).use(i18n).mount('#app')

if ('serviceWorker' in navigator) {
  startAppUpdates(navigator.serviceWorker, document, () => location.reload())

  // A tapped Reminder opens that Event's details (see notificationOpen.ts)
  const go = (path: string | null) => {
    if (path && router.currentRoute.value.fullPath !== path) void router.push(path)
  }
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type !== 'open') return
    void takeNotificationOpen() // used now, not again on the next start
    go(safePath(e.data.path))
  })
  const pending = async () => go(await takeNotificationOpen())
  void router.isReady().then(pending)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pending()
  })
}
