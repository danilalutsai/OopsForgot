/**
 * Keeps the installed app on the newest version. It looks for one when the app opens and each time it
 * comes back to the foreground; the service worker takes over at once (skipWaiting), and the page then
 * reloads into it. Never in the middle of an open sheet: then it waits until the app comes back.
 */
export function startAppUpdates(
  sw: Pick<ServiceWorkerContainer, 'controller' | 'ready' | 'addEventListener'>,
  doc: Pick<Document, 'visibilityState' | 'querySelector' | 'addEventListener'>,
  reload: () => void,
) {
  // the first visit has no old version to leave: its service worker taking over needs no reload
  const hadVersion = !!sw.controller
  let waiting = false
  const check = () => void sw.ready.then((r) => r.update()).catch(() => {})
  function reloadIfFree() {
    if (!waiting || doc.querySelector('[role="dialog"]')) return
    waiting = false
    reload()
  }
  sw.addEventListener('controllerchange', () => {
    if (!hadVersion) return
    waiting = true
    reloadIfFree()
  })
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState !== 'visible') return
    reloadIfFree()
    check()
  })
  check()
}
