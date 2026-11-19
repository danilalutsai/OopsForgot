import { computed, ref } from 'vue'
import { browserTimeZone, useAuth } from '../stores/auth'

// "Keep old" is remembered per browser time zone, so the question comes back only after another move.
const KEEP_KEY = 'oopsforgot.keepTimeZone'
const kept = ref(read())

function read(): string | null {
  try {
    return localStorage.getItem(KEEP_KEY)
  } catch {
    return null
  }
}

/** True when this device is in a different time zone from the saved one and the person hasn't said to keep it. */
export const timeZoneDiffers = computed(() => {
  const saved = useAuth().profile?.time_zone
  const here = browserTimeZone()
  return !!saved && saved !== here && kept.value !== here
})

export function keepSavedTimeZone() {
  kept.value = browserTimeZone()
  try {
    localStorage.setItem(KEEP_KEY, kept.value)
  } catch {
    // private mode: the question just comes back next time
  }
}
