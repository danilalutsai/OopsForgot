<script setup lang="ts">
import { DEFAULT_DAY_REMINDER_TIME, roundToQuarterHour } from '@oopsproof/shared'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatTime } from '../format'
import SheetLine from '../items/SheetLine.vue'
import { INPUT } from '../items/ui'
import { removePhoto, squarePhoto, uploadPhoto } from '../settings/photo'
import { keepSavedTimeZone, timeZoneDiffers } from '../settings/timeZoneCheck'
import { browserTimeZone, type Profile, useAuth } from '../stores/auth'
import AvatarImage from '../components/AvatarImage.vue'

const auth = useAuth()
const { t } = useI18n()
const openLine = ref<string | null>(null)
const toast = ref<string | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)
const here = browserTimeZone()
const timeZones = Intl.supportedValuesOf('timeZone')
const currencies = Intl.supportedValuesOf('currency')

const profile = computed(() => auth.profile)
const name = ref(profile.value?.name ?? '')
const surname = ref(profile.value?.surname ?? '')

const toggle = (line: string) => (openLine.value = openLine.value === line ? null : line)

let toastTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(toastTimer))

/** Every line saves as soon as it changes. */
async function save(changes: Partial<Profile>, closeLine = false) {
  error.value = null
  busy.value = true
  const failed = await auth.updateProfile(changes)
  busy.value = false
  if (failed) return (error.value = 'settings.saveError')
  if (closeLine) openLine.value = null
  clearTimeout(toastTimer)
  toast.value = 'settings.saved'
  toastTimer = setTimeout(() => (toast.value = null), 2000)
}

const dayTime = computed(() => profile.value?.day_reminder_time.slice(0, 5) ?? DEFAULT_DAY_REMINDER_TIME)
function setDayTime(value: string) {
  if (value) void save({ day_reminder_time: roundToQuarterHour(value) })
}

function saveName() {
  if (!name.value.trim() || !surname.value.trim()) return (error.value = 'auth.errors.required')
  void save({ name: name.value.trim(), surname: surname.value.trim() })
}

const photoInput = ref<HTMLInputElement>()
async function pickPhoto(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !auth.session) return
  try {
    busy.value = true
    const path = await uploadPhoto(auth.session.user.id, await squarePhoto(file), profile.value?.photo_path ?? null)
    await save({ photo_path: path })
  } catch {
    error.value = 'settings.photoError'
  } finally {
    busy.value = false
    if (photoInput.value) photoInput.value.value = ''
  }
}
async function dropPhoto() {
  const path = profile.value?.photo_path
  if (!path) return
  await save({ photo_path: null })
  await removePhoto(path)
}

const lines = {
  dayTime: () => formatTime(`${dayTime.value}:00`),
  timeZone: () => profile.value?.time_zone ?? '',
  currency: () => profile.value?.currency ?? '',
  profile: () => (profile.value ? `${profile.value.name} ${profile.value.surname}` : ''),
}
const heading = 'px-3 pt-6 pb-1 text-[13px] font-semibold tracking-wide text-muted uppercase'
</script>

<template>
  <header class="flex items-center gap-2 px-4 pt-5 pb-2">
    <RouterLink to="/" class="text-accent md:hidden">‹ {{ $t('settings.back') }}</RouterLink>
    <h1 class="flex-1 text-center text-[19px] font-bold md:text-left">{{ $t('settings.title') }}</h1>
    <span class="w-12 md:hidden" />
  </header>

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

    <h2 :class="heading">{{ $t('settings.sections.reminders') }}</h2>
    <SheetLine
      :label="$t('settings.dayTime')"
      :value="lines.dayTime()"
      :open="openLine === 'dayTime'"
      @toggle="toggle('dayTime')"
    >
      <input
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
        :value="profile.time_zone"
        :aria-label="$t('settings.timeZone')"
        :class="INPUT"
        @change="save({ time_zone: ($event.target as HTMLSelectElement).value }, true)"
      >
        <option v-for="z in timeZones" :key="z" :value="z">{{ z }}</option>
      </select>
      <p class="mt-2 text-sm text-muted">{{ $t('settings.timeZoneHint', { here }) }}</p>
    </SheetLine>

    <h2 :class="heading">{{ $t('settings.sections.money') }}</h2>
    <SheetLine
      :label="$t('settings.currency')"
      :value="lines.currency()"
      :open="openLine === 'currency'"
      @toggle="toggle('currency')"
    >
      <p class="mb-2 text-sm font-medium text-urgent-yellow-text">{{ $t('settings.currencyWarning') }}</p>
      <select
        :value="profile.currency"
        :aria-label="$t('settings.currency')"
        :class="INPUT"
        @change="save({ currency: ($event.target as HTMLSelectElement).value }, true)"
      >
        <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
      </select>
    </SheetLine>

    <h2 :class="heading">{{ $t('settings.sections.account') }}</h2>
    <SheetLine
      :label="$t('settings.profile')"
      :value="lines.profile()"
      :open="openLine === 'profile'"
      @toggle="toggle('profile')"
    >
      <div class="flex items-center gap-3">
        <AvatarImage size="lg" />
        <div class="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            class="rounded-full border border-line px-3 py-1.5 font-semibold"
            :disabled="busy"
            @click="photoInput?.click()"
          >
            {{ profile.photo_path ? $t('settings.changePhoto') : $t('settings.addPhoto') }}
          </button>
          <button
            v-if="profile.photo_path"
            type="button"
            class="rounded-full border border-line px-3 py-1.5 font-semibold text-urgent-red"
            :disabled="busy"
            @click="dropPhoto"
          >
            {{ $t('settings.removePhoto') }}
          </button>
        </div>
        <input
          ref="photoInput"
          type="file"
          accept="image/*"
          class="sr-only"
          :aria-label="$t('settings.photo')"
          @change="pickPhoto"
        />
      </div>
      <div class="mt-3 grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium">{{ $t('auth.name') }}</span>
          <input v-model="name" :class="INPUT" autocomplete="given-name" @change="saveName" />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium">{{ $t('auth.surname') }}</span>
          <input v-model="surname" :class="INPUT" autocomplete="family-name" @change="saveName" />
        </label>
      </div>
    </SheetLine>

    <h2 :class="heading">{{ $t('settings.sections.privacy') }}</h2>
    <RouterLink to="/privacy" class="flex justify-between rounded-xl px-3 py-3 hover:bg-bg">
      <span>{{ $t('settings.privacyNotice') }}</span><span class="text-muted" aria-hidden="true">›</span>
    </RouterLink>
  </div>

  <p
    v-if="toast"
    role="status"
    class="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-text px-4 py-2 text-sm text-bg shadow-lg md:bottom-8"
  >
    {{ t(toast) }}
  </p>
</template>
