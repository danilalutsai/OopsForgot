import { gsap } from 'gsap'
import { ref } from 'vue'
import { duration, reducedMotion } from '../motion'

/** How far a finger must travel sideways before it counts as a swipe and not a tap. */
const SLOP = 10
/** Sideways wheel distance (a trackpad swipe) that changes the period. */
const WHEEL_STEP = 50

/**
 * Sideways swipe on the calendar: a finger or mouse drag follows the pointer and changes the period
 * when it travels far enough (else snaps back); a trackpad's sideways swipe does the same.
 * `step` is +1 for the next period (swipe left), -1 for the previous one (swipe right).
 * `direction` tells the slide transition which way the new period comes in (0: no slide), and
 * `offset` where the old period was when the finger let go, so it slides on from there.
 * Bind it to a frame that stays while the periods inside it change: a swipe that starts during a
 * slide still lands.
 */
export function usePeriodSwipe(change: (step: 1 | -1) => void) {
  const direction = ref<-1 | 0 | 1>(0)
  let offset = 0
  let start: { x: number; y: number; id: number; el: HTMLElement } | null = null
  let dragging = false
  /** The click that ends a drag must not pick the day under the pointer. */
  let swallowClick = false
  let wheel = 0
  let wheelLocked = false
  let wheelQuiet: ReturnType<typeof setTimeout> | undefined

  function go(step: 1 | -1, from = 0) {
    offset = from
    direction.value = step
    change(step)
  }

  function snapBack(el: HTMLElement) {
    gsap.to(el, { x: 0, duration: duration(0.2), ease: 'power2.out', clearProps: 'transform' })
  }

  function onPointerdown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    start = { x: e.clientX, y: e.clientY, id: e.pointerId, el: e.currentTarget as HTMLElement }
    dragging = false
  }

  function onPointermove(e: PointerEvent) {
    if (!start || e.pointerId !== start.id) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (!dragging) {
      // up or down first: the page scrolls, this is no swipe
      if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) return void (start = null)
      if (Math.abs(dx) < SLOP) return
      dragging = true
      try {
        start.el.setPointerCapture(e.pointerId)
      } catch {
        // a pointer the browser no longer tracks: the drag still works without capture
      }
    }
    if (!reducedMotion()) gsap.set(start.el, { x: dx })
  }

  function onPointerup(e: PointerEvent) {
    if (!start || e.pointerId !== start.id) return
    const { el, x } = start
    const dx = e.clientX - x
    const wasDragging = dragging
    start = null
    dragging = false
    if (!wasDragging) return
    swallowClick = true
    setTimeout(() => (swallowClick = false), 50)
    if (Math.abs(dx) >= Math.min(80, el.offsetWidth * 0.2)) {
      // the frame goes back at once; the old period inside it slides on from where the finger left it
      gsap.set(el, { clearProps: 'transform' })
      go(dx < 0 ? 1 : -1, reducedMotion() ? 0 : dx)
    } else snapBack(el)
  }

  function onPointercancel() {
    if (start && dragging) snapBack(start.el)
    start = null
    dragging = false
  }

  function onClickCapture(e: MouseEvent) {
    if (!swallowClick) return
    swallowClick = false
    e.stopPropagation()
    e.preventDefault()
  }

  /** A trackpad swipe sideways: one period per gesture, however long its momentum goes on. */
  function onWheel(e: WheelEvent) {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
    // keep the browser from going back a page on a sideways swipe
    e.preventDefault()
    clearTimeout(wheelQuiet)
    wheelQuiet = setTimeout(() => {
      wheel = 0
      wheelLocked = false
    }, 300)
    if (wheelLocked) return
    wheel += e.deltaX
    if (Math.abs(wheel) < WHEEL_STEP) return
    wheelLocked = true
    go(wheel > 0 ? 1 : -1)
  }

  return {
    direction,
    /** Where the old period was when let go (px); read once by the slide out. */
    takeOffset: () => {
      const from = offset
      offset = 0
      return from
    },
    /** Next or previous by a button: slides the same way as a swipe. */
    go,
    /** Bind to the element that moves: pointer events, a capturing click, and a non-passive wheel. */
    bind: {
      onPointerdown,
      onPointermove,
      onPointerup,
      onPointercancel,
      onClickCapture,
    },
    onWheel,
  }
}
