import { ref } from 'vue'

export type Theme = 'system' | 'light' | 'dark'
export const THEMES: Theme[] = ['system', 'light', 'dark']

const KEY = 'theme'

function stored(): Theme {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

/** The theme picked on this device; public/theme.js applies it before the page draws. */
export const theme = ref<Theme>(stored())

export function setTheme(next: Theme) {
  theme.value = next
  const root = document.documentElement
  if (next === 'system') delete root.dataset.theme
  else root.dataset.theme = next
  try {
    if (next === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
  } catch {
    // no storage (private mode): the choice lasts until the page closes
  }
}
