import { todayIn } from '@oopsproof/shared'
import { computed, ref } from 'vue'
import { browserTimeZone, useAuth } from './stores/auth'

const now = ref(new Date())
setInterval(() => (now.value = new Date()), 60_000)

/** The person's saved time zone (the browser's until the profile has loaded). */
export const timeZone = computed(() => useAuth().profile?.time_zone ?? browserTimeZone())

/** Today's date in the person's time zone; refreshed every minute so countdowns roll over at midnight. */
export const today = computed(() => todayIn(timeZone.value, now.value))

/** The person's currency; amounts are never converted. */
export const currency = computed(() => useAuth().profile?.currency ?? 'EUR')
