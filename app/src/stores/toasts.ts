import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: number
  key: string
  params?: Record<string, unknown>
  /** Shown as an Undo button for a few seconds. */
  undo?: () => Promise<unknown> | void
}

/** Short messages at the bottom of the screen, one at a time; ones with Undo stay a little longer. */
export const useToasts = defineStore('toasts', () => {
  const current = ref<Toast | null>(null)
  /** A plain message that arrived while an Undo was on screen; it shows once the Undo is gone. */
  let waiting: Toast | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let next = 0

  function display(toast: Toast) {
    clearTimeout(timer)
    current.value = toast
    timer = setTimeout(
      () => {
        if (current.value?.id !== toast.id) return
        current.value = null
        if (waiting) display(waiting)
        waiting = null
      },
      toast.undo ? 5000 : 2500,
    )
  }

  function show(key: string, params?: Record<string, unknown>, undo?: Toast['undo']) {
    const toast = { id: ++next, key, params, undo }
    // Never take away a chance to Undo for a plain message.
    if (current.value?.undo && !undo) waiting = toast
    else display(toast)
  }

  async function undo() {
    const action = current.value?.undo
    current.value = null
    clearTimeout(timer)
    if (waiting) display(waiting)
    waiting = null
    await action?.()
  }

  return { current, show, undo }
})
