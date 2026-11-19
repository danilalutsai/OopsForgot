import { DEFAULT_DAY_REMINDER_TIME, nowIn, todayIn } from '@oopsforgot/shared'
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

/** Local date and time now ("YYYY-MM-DDTHH:MM") in the person's time zone. */
export const nowLocal = computed(() => nowIn(timeZone.value, now.value))

/** When day Reminders arrive, "HH:MM". */
export const dayReminderTime = computed(
  () => useAuth().profile?.day_reminder_time.slice(0, 5) ?? DEFAULT_DAY_REMINDER_TIME,
)
