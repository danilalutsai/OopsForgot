import { todayIn } from '@oopsproof/shared'
import { ref } from 'vue'

// TODO(#39): use the time zone saved on the profile once Settings exists.
const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/** Today's date in the person's time zone; refreshed every minute so countdowns roll over at midnight. */
export const today = ref(todayIn(timeZone(), new Date()))
setInterval(() => (today.value = todayIn(timeZone(), new Date())), 60_000)

// TODO(#39): use the currency saved on the profile once Settings exists.
export const currency = 'EUR'
