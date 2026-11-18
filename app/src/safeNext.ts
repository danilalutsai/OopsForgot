/** Where to go after logging in: only a page inside the app, never another site. */
export function safeNext(next: unknown): string {
  return typeof next === 'string' && /^\/(?![/\\])/.test(next) ? next : '/'
}

/**
 * Busy flags must come undone when the person comes back from Google with the Back button:
 * the browser may show the page exactly as it was left, mid-click.
 */
export function onBackFromAnotherSite(reset: () => void) {
  const handler = (e: PageTransitionEvent) => e.persisted && reset()
  window.addEventListener('pageshow', handler)
  return () => window.removeEventListener('pageshow', handler)
}
