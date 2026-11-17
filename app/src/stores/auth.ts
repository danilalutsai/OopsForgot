import type { Session } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { initials as initialsOf } from '@oopsproof/shared'
import { computed, ref, watch } from 'vue'
import { queryClient } from '../query'
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
}

const PROFILE_COLUMNS = 'name, surname, time_zone, currency, day_reminder_time, photo_path'

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

  /** Loads the profile of whoever is logged in now; a slower answer for an earlier person is dropped. */
  async function loadProfile() {
    const userId = session.value?.user.id
    if (!userId) return (profile.value = null)
    const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).single()
    if (session.value?.user.id !== userId) return
    if (error) console.error('Could not load profile', error)
    profile.value = data
  }

  // Registered before anything is awaited: Supabase fires PASSWORD_RECOVERY while it starts up.
  supabase.auth.onAuthStateChange((event, next) => {
    if (event === 'PASSWORD_RECOVERY') recovering.value = true
    if (event === 'SIGNED_OUT') recovering.value = false
    const hadUser = !!session.value
    const changedUser = next?.user.id !== session.value?.user.id
    session.value = next
    if (changedUser) {
      // Never show one person's data to the next person on the same device,
      // and never let the previous person's Reminders keep arriving in this browser.
      queryClient.clear()
      if (hadUser) void unsubscribeThisBrowser()
      void loadProfile()
    }
  })

  /** Resolves once the saved session (if any) is known. */
  const ready = (async () => {
    session.value = (await supabase.auth.getSession()).data.session
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
    queryClient.clear()
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
  }
})
