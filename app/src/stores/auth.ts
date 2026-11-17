import type { Session } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { queryClient } from '../query'
import { supabase } from '../supabase'

export interface Profile {
  name: string
  surname: string
}

export const useAuth = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const profile = ref<Profile | null>(null)
  const recovering = ref(false)
  const loggedIn = computed(() => session.value !== null)

  /** Loads the profile of whoever is logged in now; a slower answer for an earlier person is dropped. */
  async function loadProfile() {
    const userId = session.value?.user.id
    if (!userId) return (profile.value = null)
    const { data, error } = await supabase.from('profiles').select('name, surname').single()
    if (session.value?.user.id !== userId) return
    if (error) console.error('Could not load profile', error)
    profile.value = data
  }

  // Registered before anything is awaited: Supabase fires PASSWORD_RECOVERY while it starts up.
  supabase.auth.onAuthStateChange((event, next) => {
    if (event === 'PASSWORD_RECOVERY') recovering.value = true
    if (event === 'SIGNED_OUT') recovering.value = false
    const changedUser = next?.user.id !== session.value?.user.id
    session.value = next
    if (changedUser) {
      // Never show one person's data to the next person on the same device.
      queryClient.clear()
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
        data: { name: input.name.trim(), surname: input.surname.trim(), confirmed_16_plus: true },
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

  return { session, profile, recovering, loggedIn, ready, signUp, logIn, logOut, sendPasswordReset, setNewPassword }
})
