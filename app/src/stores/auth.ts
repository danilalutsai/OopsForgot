import type { Session } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { initials as initialsOf } from '@oopsproof/shared'
import { computed, ref, watch } from 'vue'
import { online } from '../online'
import { keepOfflineCopyFor, restored, wipeOfflineCopy } from '../query'
import { guessCurrency } from '../currency'
import { photoUrl as signedPhotoUrl } from '../settings/photo'
import { forgetThisDevice, unsubscribeThisBrowser } from '../push/forget'
import { supabase } from '../supabase'

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

export interface Profile {
  name: string
  surname: string
  time_zone: string
  currency: string
  /** "12:00:00" */
  day_reminder_time: string
  photo_path: string | null
  /** the Calendar feed's secret, or null when the feed is off */
  calendar_token: string | null
}

const PROFILE_COLUMNS = 'name, surname, time_zone, currency, day_reminder_time, photo_path, calendar_token'

/** The profile is saved on the device next to the offline copy, so dates and money stay right offline. */
const PROFILE_KEY = 'oopsproof-profile'

function savedProfile(userId: string): Profile | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null')
    return saved?.userId === userId ? saved.profile : null
  } catch {
    return null
  }
}

export const useAuth = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const profile = ref<Profile | null>(null)
  const recovering = ref(false)
  const loggedIn = computed(() => session.value !== null)
  const initials = computed(() => (profile.value ? initialsOf(profile.value.name, profile.value.surname) : ''))

  /** A short-lived link to the profile photo, renewed before it expires; a late answer for an older photo is dropped. */
  const photoUrl = ref<string | null>(null)
  let photoTimer: ReturnType<typeof setInterval> | undefined
  watch(
    () => profile.value?.photo_path,
    async (path) => {
      clearInterval(photoTimer)
      const load = async () => {
        const url = path ? await signedPhotoUrl(path) : null
        if (profile.value?.photo_path === path) photoUrl.value = url
      }
      await load()
      if (path) photoTimer = setInterval(load, 50 * 60 * 1000)
    },
  )

  let fromSavedCopy = false

  /** Loads the profile of whoever is logged in now; a slower answer for an earlier person is dropped. */
  async function loadProfile() {
    const userId = session.value?.user.id
    if (!userId) return (profile.value = null)
    // offline the request would only retry and hold up the app: use the copy saved on this device
    if (!online.value) {
      profile.value = savedProfile(userId)
      fromSavedCopy = true
      return
    }
    const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).single()
    if (session.value?.user.id !== userId) return
    if (error) {
      // a real problem: say so, and fall back to the saved copy rather than nothing
      console.error('Could not load profile', error)
      profile.value = savedProfile(userId)
      fromSavedCopy = true
      return
    }
    profile.value = data
    fromSavedCopy = false
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ userId, profile: data }))
    } catch {
      // no saved copy, nothing breaks
    }
  }

  // Registered before anything is awaited: Supabase fires PASSWORD_RECOVERY while it starts up.
  supabase.auth.onAuthStateChange((event, next) => {
    if (event === 'PASSWORD_RECOVERY') recovering.value = true
    if (event === 'SIGNED_OUT') recovering.value = false
    const hadUser = !!session.value
    const changedUser = next?.user.id !== session.value?.user.id
    session.value = next
    if (changedUser) {
      // Never show one person's data to the next person on the same device: the saved offline copy
      // is kept only if it is this person's (an expired session or a new login wipes anyone else's).
      // And never let the previous person's Reminders keep arriving in this browser.
      void keepOfflineCopyFor(next?.user.id ?? null)
      if (hadUser) void unsubscribeThisBrowser()
      void loadProfile()
    }
  })

  // back online: refresh the profile if it was read from the saved copy
  watch(online, (isOnline) => {
    if (isOnline && fromSavedCopy) void loadProfile()
  })

  /** Resolves once the saved session (if any) is known. */
  const ready = (async () => {
    session.value = (await supabase.auth.getSession()).data.session
    await keepOfflineCopyFor(session.value?.user.id ?? null)
    await restored
    await loadProfile()
  })()

  const origin = () => window.location.origin

  async function signUp(input: { email: string; password: string; name: string; surname: string }) {
    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${origin()}/`,
        data: {
          name: input.name.trim(),
          surname: input.surname.trim(),
          confirmed_16_plus: true,
          time_zone: browserTimeZone(),
          currency: guessCurrency(),
        },
      },
    })
    return error
  }

  /** The profile loads through the SIGNED_IN event. */
  async function logIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function logOut() {
    // This browser's push subscription must not keep delivering this person's Reminders to the next person.
    await forgetThisDevice()
    await supabase.auth.signOut({ scope: 'local' })
    session.value = null
    profile.value = null
    recovering.value = false
    await wipeOfflineCopy()
    try {
      localStorage.removeItem(PROFILE_KEY)
    } catch {
      // nothing saved
    }
  }

  async function sendPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/reset-password` })
    return error
  }

  async function setNewPassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) recovering.value = false
    return error
  }

  /** Saves profile changes and keeps the local copy in step; returns the error, if any. */
  async function updateProfile(changes: Partial<Profile>) {
    const userId = session.value?.user.id
    if (!userId) return new Error('Not logged in')
    const { data, error } = await supabase
      .from('profiles')
      .update(changes)
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single()
    if (!error) profile.value = data
    return error
  }

  /** Feed changes go through the server (the token is made there); the local copy follows. */
  async function setCalendarFeed(on: boolean) {
    if (!session.value || !profile.value) return new Error('Not logged in')
    if (on) {
      const { data, error } = await supabase.rpc('new_calendar_link')
      if (!error) profile.value = { ...profile.value, calendar_token: data as string }
      return error
    }
    const { error } = await supabase.rpc('turn_off_calendar_feed')
    if (!error) profile.value = { ...profile.value, calendar_token: null }
    return error
  }

  return {
    session,
    profile,
    initials,
    photoUrl,
    recovering,
    loggedIn,
    ready,
    signUp,
    logIn,
    logOut,
    sendPasswordReset,
    setNewPassword,
    updateProfile,
    setCalendarFeed,
  }
})
