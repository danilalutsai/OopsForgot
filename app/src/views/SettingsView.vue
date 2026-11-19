<script setup lang="ts">
import { DEFAULT_DAY_REMINDER_TIME, roundToQuarterHour } from '@oopsproof/shared'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatTime } from '../format'
import SheetLine from '../items/SheetLine.vue'
import { INPUT, SECTION_TITLE } from '../items/ui'
import { keepSavedTimeZone, timeZoneDiffers } from '../settings/timeZoneCheck'
import { browserTimeZone, useAuth } from '../stores/auth'
import { useProfileSave } from '../settings/profileSave'
import PageHeader from '../components/PageHeader.vue'
import { dayReminderTime } from '../today'
import PushSettings from '../push/PushSettings.vue'
import CalendarFeed from '../settings/CalendarFeed.vue'
import { CONTACT_EMAIL } from '../contact'
import { usePushDevices } from '../push/devices'

const auth = useAuth()
const { t } = useI18n()
const openLine = ref<string | null>(null)
const here = browserTimeZone()
// The saved zone is always offered, even when the browser's list lacks it (Chrome has no plain "UTC").
const timeZones = computed(() => {
  const list = Intl.supportedValuesOf('timeZone')
  const saved = auth.profile?.time_zone
  return saved && !list.includes(saved) ? [saved, ...list] : list
})
const currencies = Intl.supportedValuesOf('currency')

const profile = computed(() => auth.profile)
const toggle = (line: string) => (openLine.value = openLine.value === line ? null : line)
const { error, redraw, save } = useProfileSave(openLine)

const dayTime = dayReminderTime
function setDayTime(value: string) {
  if (value) void save({ day_reminder_time: roundToQuarterHour(value) })
}

const devices = usePushDevices()
const lines = {
  push: () => {
    const n = devices.data.value?.length ?? 0
    return n ? t('settings.pushOn', { n }, n) : t('settings.pushOff')
  },
  dayTime: () => formatTime(`${dayTime.value}:00`),
  timeZone: () => profile.value?.time_zone ?? '',
  currency: () => profile.value?.currency ?? '',
}
</script>

<template>
  <PageHeader :title="$t('settings.title')" />

  <div v-if="profile" class="mx-auto w-full max-w-xl px-1 pb-10">
    <section v-if="timeZoneDiffers" class="mx-3 mt-2 rounded-2xl border border-urgent-yellow bg-urgent-yellow/10 p-4">
      <h2 class="font-semibold">{{ $t('settings.tzTitle') }}</h2>
      <p class="mt-1 text-sm">{{ $t('settings.tzBody', { here, saved: profile.time_zone }) }}</p>
      <div class="mt-3 flex gap-2">
        <button
          type="button"
          class="rounded-full bg-accent px-4 py-1.5 font-semibold text-on-accent"
          @click="save({ time_zone: here })"
        >
          {{ $t('settings.useNew') }}
        </button>
        <button
          type="button"
          class="rounded-full border border-line px-4 py-1.5 font-semibold"
          @click="keepSavedTimeZone"
        >
          {{ $t('settings.keepOld') }}
        </button>
      </div>
    </section>

    <p v-if="error" role="alert" class="mx-3 mt-3 rounded-xl bg-urgent-red/10 p-3 text-sm font-medium text-urgent-red">
      {{ $t(error) }}
    </p>

    <h2 :class="SECTION_TITLE">{{ $t('settings.sections.reminders') }}</h2>
    <SheetLine :label="$t('push.section')" :value="lines.push()" :open="openLine === 'push'" @toggle="toggle('push')">
      <PushSettings />
    </SheetLine>
    <SheetLine
      :label="$t('settings.dayTime')"
      :value="lines.dayTime()"
      :open="openLine === 'dayTime'"
      @toggle="toggle('dayTime')"
    >
      <input
        :key="`time-${redraw}`"
        type="time"
        step="900"
        :value="dayTime"
        :aria-label="$t('settings.dayTime')"
        :class="INPUT"
        @change="setDayTime(($event.target as HTMLInputElement).value)"
      />
      <p class="mt-2 text-sm text-muted">{{ $t('settings.dayTimeHint') }}</p>
      <button
        v-if="dayTime !== DEFAULT_DAY_REMINDER_TIME"
        type="button"
        class="mt-2 text-sm font-semibold text-accent"
        @click="setDayTime(DEFAULT_DAY_REMINDER_TIME)"
      >
        {{ $t('settings.backTo12') }}
      </button>
    </SheetLine>
    <SheetLine
      :label="$t('settings.timeZone')"
      :value="lines.timeZone()"
      :open="openLine === 'timeZone'"
      @toggle="toggle('timeZone')"
    >
      <select
        :key="`zone-${redraw}`"
        :value="profile.time_zone"
        :aria-label="$t('settings.timeZone')"
        :class="INPUT"
        @change="save({ time_zone: ($event.target as HTMLSelectElement).value }, true)"
      >
        <option v-for="z in timeZones" :key="z" :value="z">{{ z }}</option>
      </select>
      <p class="mt-2 text-sm text-muted">{{ $t('settings.timeZoneHint', { here }) }}</p>
    </SheetLine>

    <h2 :class="SECTION_TITLE">{{ $t('calendarFeed.section') }}</h2>
    <SheetLine
      :label="$t('calendarFeed.line')"
      :value="profile.calendar_token ? $t('calendarFeed.on') : $t('calendarFeed.off')"
      :open="openLine === 'calendar'"
      @toggle="toggle('calendar')"
    >
      <CalendarFeed />
    </SheetLine>

    <h2 :class="SECTION_TITLE">{{ $t('settings.sections.money') }}</h2>
    <SheetLine
      :label="$t('settings.currency')"
      :value="lines.currency()"
      :open="openLine === 'currency'"
      @toggle="toggle('currency')"
    >
      <p class="mb-2 text-sm font-medium text-urgent-yellow-text">{{ $t('settings.currencyWarning') }}</p>
      <select
        :key="`currency-${redraw}`"
        :value="profile.currency"
        :aria-label="$t('settings.currency')"
        :class="INPUT"
        @change="save({ currency: ($event.target as HTMLSelectElement).value }, true)"
      >
        <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
      </select>
    </SheetLine>

    <h2 :class="SECTION_TITLE">{{ $t('settings.sections.privacy') }}</h2>
    <RouterLink to="/privacy" class="flex justify-between rounded-xl px-3 py-3 hover:bg-bg">
      <span>{{ $t('settings.privacyNotice') }}</span><span class="text-muted" aria-hidden="true">›</span>
    </RouterLink>
    <section class="px-3 py-3" :aria-label="$t('login.copyTitle')">
      <h3 class="font-medium">{{ $t('login.copyTitle') }}</h3>
      <p class="mt-1 text-sm text-muted">{{ $t('login.copyBody', { contact: CONTACT_EMAIL }) }}</p>
    </section>
  </div>
</template>
