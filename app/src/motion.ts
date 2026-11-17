import { gsap } from 'gsap'

/** Light UI motion only (0.15–0.3 s, ease-out, no bounce); none at all when the device asks for reduced motion. */
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const duration = (seconds: number) => (reducedMotion() ? 0 : seconds)

/** Vue <Transition> hooks that open and close an element by its height. */
export const heightTransition = {
  onEnter(el: Element, done: () => void) {
    gsap.from(el, {
      height: 0,
      opacity: 0,
      duration: duration(0.2),
      ease: 'power2.out',
      clearProps: 'all',
      onComplete: done,
    })
  },
  onLeave(el: Element, done: () => void) {
    gsap.to(el, { height: 0, opacity: 0, duration: duration(0.15), ease: 'power2.out', onComplete: done })
  },
}

/** Vue <Transition> hooks that fade one view out and the next in. */
export const fadeTransition = {
  onEnter(el: Element, done: () => void) {
    gsap.from(el, { opacity: 0, duration: duration(0.15), ease: 'power2.out', clearProps: 'opacity', onComplete: done })
  },
  onLeave(el: Element, done: () => void) {
    gsap.to(el, { opacity: 0, duration: duration(0.1), ease: 'power2.out', onComplete: done })
  },
}
