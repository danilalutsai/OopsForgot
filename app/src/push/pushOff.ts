import { computed, ref } from 'vue'
import { useAuth } from '../stores/auth'
import { usePushDevices } from './devices'

// "Keep off" is remembered on this device, per person: the dot and the notes stop until they turn it on.
const KEEP_KEY = 'oopsforgot.keepPushOff'
const keptBy = ref(read())

function read(): string | null {
  try {
    return localStorage.getItem(KEEP_KEY)
  } catch {
    return null
  }
}

function remember(userId: string | null) {
  keptBy.value = userId
  try {
    if (userId) localStorage.setItem(KEEP_KEY, userId)
    else localStorage.removeItem(KEEP_KEY)
  } catch {
    // private mode: the note just comes back next time
  }
}

/** True once we know no device gets push: Reminders can't reach the person. */
export function usePushIsOff() {
  const devices = usePushDevices()
  return computed(() => devices.isSuccess.value && devices.data.value?.length === 0)
}

/**
 * Push is off and the person hasn't chosen to keep it off: the amber dot on the avatar, the card at
 * the top of Settings and the note above the Events.
 */
export function usePushOff() {
  const off = usePushIsOff()
  const auth = useAuth()
  return computed(() => off.value && keptBy.value !== auth.session?.user.id)
}

/** "Keep off": the person knows, and doesn't want notifications. */
export function keepPushOff() {
  remember(useAuth().session?.user.id ?? null)
}

/** Notifications turned on: should they go off again later, say so again. */
export function forgetKeepPushOff() {
  remember(null)
}
