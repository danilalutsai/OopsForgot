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
  let timer: ReturnType<typeof setTimeout> | undefined
  let next = 0

  function show(key: string, params?: Record<string, unknown>, undo?: Toast['undo']) {
    clearTimeout(timer)
    const toast = { id: ++next, key, params, undo }
    current.value = toast
    timer = setTimeout(() => current.value?.id === toast.id && (current.value = null), undo ? 5000 : 2500)
  }

  async function undo() {
    const action = current.value?.undo
    current.value = null
    clearTimeout(timer)
    await action?.()
  }

  return { current, show, undo }
})
