import type { Session } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { initials as initialsOf } from '@oopsforgot/shared'
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
  /** set once they remove a photo: the Google one is not shown again, the initials are */
  google_photo_hidden: boolean
  /** the Calendar feed's secret, or null when the feed is off */
  calendar_token: string | null
  /** null for a Google signup that has not yet said they are 16 or older */
  confirmed_16_plus_at: string | null
  /** days an Expired Item stays before it is deleted: 7, 30 or 90; null = never */
  expired_cleanup_days: number | null
}

const PROFILE_COLUMNS =
  'name, surname, time_zone, currency, day_reminder_time, photo_path, google_photo_hidden, calendar_token, confirmed_16_plus_at, expired_cleanup_days'

/** The profile is saved on the device next to the offline copy, so dates and money stay right offline. */
const PROFILE_KEY = 'oopsforgot-profile'

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
  /** A Google signup still to confirm 16+ (a copy saved before this was known counts as confirmed). */
  const needsWelcome = computed(() => profile.value?.confirmed_16_plus_at === null)
  /**
   * Whether the account has a password to type again; Google-only accounts sign in with Google instead.
   * Asked from the server (a password added later leaves no trace in the session), guessed until then.
   */
  const passwordOnServer = ref<boolean | null>(null)
  const hasPassword = computed(
    () => passwordOnServer.value ?? (session.value?.user.identities ?? []).some((i) => i.provider === 'email'),
  )
  /** Whether Google is one of the ways in, and whether another way in remains without it. */
  const googleConnected = computed(() => (session.value?.user.identities ?? []).some((i) => i.provider === 'google'))
  const googleRemovable = computed(() => googleConnected.value && (session.value?.user.identities ?? []).length > 1)
  /** A new email waiting for its confirmation links; the old one works until then. */
  const pendingEmail = computed(() => session.value?.user.new_email ?? null)

  /** A short-lived link to the profile photo, renewed before it expires; a late answer for an older photo is dropped. */
  const ownPhotoUrl = ref<string | null>(null)
  /** The person's own photo, or their Google one until they add their own or remove it. */
  const photoUrl = computed(() => {
    if (profile.value?.photo_path) return ownPhotoUrl.value
    if (profile.value?.google_photo_hidden) return null
    const google = session.value?.user.user_metadata?.avatar_url
    return typeof google === 'string' && google.startsWith('https://') ? google : null
  })
  let photoTimer: ReturnType<typeof setInterval> | undefined
  watch(
    () => profile.value?.photo_path,
    async (path) => {
      clearInterval(photoTimer)
      const load = async () => {
        const url = path ? await signedPhotoUrl(path) : null
        if (profile.value?.photo_path === path) ownPhotoUrl.value = url
      }
      await load()
      if (path) photoTimer = setInterval(load, 50 * 60 * 1000)
    },
  )

  let fromSavedCopy = false

  /**
   * Opening the app while logged in counts as use, so unused-account deletion starts over.
   * Told to the server at most once a day per person.
   */
  async function noteActivity(userId: string) {
    const key = `oopsforgot-active-${userId}`
    const day = new Date().toISOString().slice(0, 10)
    try {
      if (localStorage.getItem(key) === day) return
    } catch {
      // no memory: tell the server anyway
    }
    const { error } = await supabase.rpc('touch_activity')
    if (error) return
    try {
      localStorage.setItem(key, day)
    } catch {
      // fine: told again next time
    }
  }

  /** Keeps the copy saved on the device in step with the profile on screen. */
  function saveProfileCopy() {
    const userId = session.value?.user.id
    if (!userId || !profile.value) return
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ userId, profile: profile.value }))
    } catch {
      // no saved copy, nothing breaks
    }
  }

  /** The latest profile load, so the router can wait for it after a login. */
  let profileLoad: Promise<unknown> = Promise.resolve()
  const profileLoaded = () => profileLoad

  /** Loads the profile of whoever is logged in now; a slower answer for an earlier person is dropped. */
  function loadProfile() {
    profileLoad = readProfile()
    return profileLoad
  }

  async function readProfile() {
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
    saveProfileCopy()
    void noteActivity(userId)
    void checkAccount()
  }

  /**
   * Reads how the person logs in from the server: the password, and the account itself (ways in,
   * an email change waiting), which the saved session may hold an old copy of.
   */
  async function checkAccount() {
    const userId = session.value?.user.id
    const [password, account] = await Promise.all([supabase.rpc('has_password'), supabase.auth.getUser()])
    if (session.value?.user.id !== userId) return
    if (!password.error) passwordOnServer.value = password.data as boolean
    if (!account.error && session.value) session.value = { ...session.value, user: account.data.user }
  }

  // Registered before anything is awaited: Supabase fires PASSWORD_RECOVERY while it starts up.
  supabase.auth.onAuthStateChange((event, next) => {
    if (event === 'PASSWORD_RECOVERY') recovering.value = true
    if (event === 'SIGNED_OUT') recovering.value = false
    // a tab left open for days still counts as use whenever its session renews
    if (event === 'TOKEN_REFRESHED' && next) void noteActivity(next.user.id)
    const hadUser = !!session.value
    const changedUser = next?.user.id !== session.value?.user.id
    session.value = next
    if (changedUser) {
      passwordOnServer.value = null
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

  /** Leaves for Google's page; Supabase brings the person back to `next`, logged in. */
  async function signInWithGoogle(next = '/') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin()}${next}` },
    })
    return error
  }

  /** A Google signup checks their names and confirms 16+. */
  async function finishSignup(name: string, surname: string) {
    const { error } = await supabase.rpc('finish_signup', { name: name.trim(), surname: surname.trim() })
    if (error) return error
    await loadProfile()
    return null
  }

  /** Saves the account the server just sent back, so a reload shows it too. */
  async function keepFreshAccount() {
    const { data } = await supabase.auth.refreshSession()
    if (data.session) session.value = data.session
  }

  /** Asks for a new email; links go to the old and the new address, and the change waits for both. */
  async function changeEmail(email: string) {
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${origin()}/account` })
    if (!error) await keepFreshAccount()
    return error
  }

  /**
   * Changes the password, or adds a first one to a Google-only account. The server checks it is
   * really them (the current password, or a fresh Google sign-in), and other devices are logged
   * out. Returns the server's reason
   * when it refuses: "password", "weak", "same", "sign-in-again" or "busy".
   */
  async function changePassword(password: string, current?: string): Promise<string | null> {
    const { error } = await supabase.functions.invoke('change-password', { body: { password, current } })
    if (!error) {
      passwordOnServer.value = true
      // a new password ends every session, this one too: log this device straight back in with it
      const email = session.value?.user.email
      if (email) await supabase.auth.signInWithPassword({ email, password })
      return null
    }
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
    return typeof body?.error === 'string' ? body.error : 'busy'
  }

  /** Adds Google to this account; Google sends the person back to Settings. */
  async function connectGoogle() {
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: `${origin()}/account` },
    })
    return error
  }

  /** Removes Google from an account that has another way in (Supabase allows it only then). */
  async function disconnectGoogle() {
    const google = session.value?.user.identities?.find((i) => i.provider === 'google')
    if (!google) return null
    const { error } = await supabase.auth.unlinkIdentity(google)
    if (!error) await keepFreshAccount()
    return error
  }

  /**
   * Ends every session of this person, on every device, and stops Reminders reaching any of them
   * (one server call). This device is then cleared like a normal log out.
   */
  async function logOutEverywhere() {
    const { error } = await supabase.functions.invoke('log-out-everywhere')
    if (error) return error
    await logOut()
    return null
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
    if (!error) {
      profile.value = data
      saveProfileCopy()
    }
    return error
  }

  /** Feed changes go through the server (the token is made there); the local copy follows. */
  async function setCalendarFeed(on: boolean) {
    if (!session.value || !profile.value) return new Error('Not logged in')
    if (on) {
      const { data, error } = await supabase.rpc('new_calendar_link')
      if (!error) profile.value = { ...profile.value, calendar_token: data as string }
      saveProfileCopy()
      return error
    }
    const { error } = await supabase.rpc('turn_off_calendar_feed')
    if (!error) profile.value = { ...profile.value, calendar_token: null }
    saveProfileCopy()
    return error
  }

  return {
    session,
    profile,
    initials,
    needsWelcome,
    hasPassword,
    passwordOnServer,
    googleConnected,
    googleRemovable,
    pendingEmail,
    photoUrl,
    recovering,
    loggedIn,
    ready,
    profileLoaded,
    signUp,
    logIn,
    signInWithGoogle,
    finishSignup,
    changeEmail,
    changePassword,
    connectGoogle,
    disconnectGoogle,
    logOutEverywhere,
    logOut,
    sendPasswordReset,
    setNewPassword,
    updateProfile,
    setCalendarFeed,
  }
})
