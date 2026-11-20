import { gsap } from 'gsap'
import { duration } from '../motion'

/**
 * Phone: a sheet follows the finger on its top bar, down freely and up with a little give; past half
 * the sheet or a quick flick down closes, otherwise it springs back. When `holding()` says the sheet
 * must not just close (unsaved changes), it springs back and `ask()` runs instead.
 */
export function useSheetDrag(close: () => void, holding: () => boolean = () => false, ask: () => void = () => {}) {
  let panel: HTMLElement | null = null
  let drag: { y: number; t: number } | null = null

  function onPointerdown(e: PointerEvent) {
    // Taps on the bar's buttons stay taps; only the bar itself drags.
    if (window.matchMedia('(min-width: 768px)').matches || (e.target as HTMLElement).closest('button')) return
    // the sheet itself, found fresh each time (it is a new element every time it opens)
    panel = (e.currentTarget as HTMLElement).closest<HTMLElement>('[role="dialog"]')
    if (!panel) return
    gsap.killTweensOf(panel)
    drag = { y: e.clientY - (Number(gsap.getProperty(panel, 'y')) || 0), t: e.timeStamp }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onPointermove(e: PointerEvent) {
    if (!drag || !panel) return
    const dy = e.clientY - drag.y
    gsap.set(panel, { y: dy >= 0 ? dy : Math.max(-40, dy / 4) })
  }
  function onPointerup(e: PointerEvent) {
    if (!drag || !panel) return
    const el = panel
    const dy = e.clientY - drag.y
    const speed = dy / Math.max(1, e.timeStamp - drag.t)
    drag = null
    const closing = dy > el.offsetHeight / 2 || (speed > 0.8 && dy > 60)
    if (closing && !holding()) {
      gsap.to(el, { y: '100%', duration: duration(0.2), ease: 'power2.out', onComplete: close })
      return
    }
    gsap.to(el, { y: 0, duration: duration(0.2), ease: 'power2.out', clearProps: 'transform' })
    if (closing) ask()
  }

  return { onPointerdown, onPointermove, onPointerup, onPointercancel: onPointerup }
}
