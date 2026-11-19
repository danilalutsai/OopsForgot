import { ref, type Ref } from 'vue'
import { blockedOffline } from '../online'
import { type Profile, useAuth } from '../stores/auth'
import { useToasts } from '../stores/toasts'

/** Saving profile lines on a settings-style page: each line saves as soon as it changes. */
export function useProfileSave(openLine: Ref<string | null>) {
  const auth = useAuth()
  const toasts = useToasts()
  const error = ref<string | null>(null)
  const busy = ref(false)
  /** Bumped after every save so selects and the time input show what is really stored. */
  const redraw = ref(0)

  /** Returns whether it worked. */
  async function save(changes: Partial<Profile>, closeLine = false): Promise<boolean> {
    if (blockedOffline()) return false
    error.value = null
    busy.value = true
    const failed = await auth.updateProfile(changes)
    busy.value = false
    redraw.value++
    if (failed) {
      error.value = 'settings.saveError'
      return false
    }
    if (closeLine) openLine.value = null
    toasts.show('settings.saved')
    return true
  }

  return { error, busy, redraw, save }
}
