import type { Session } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
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

  async function loadProfile() {
    if (!session.value) return (profile.value = null)
    const { data } = await supabase.from('profiles').select('name, surname').single()
    profile.value = data
  }

  /** Resolves once the saved session (if any) is known. */
  const ready = (async () => {
    session.value = (await supabase.auth.getSession()).data.session
    await loadProfile()
    supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') recovering.value = true
      const changedUser = next?.user.id !== session.value?.user.id
      session.value = next
      if (changedUser) void loadProfile()
    })
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

  async function logIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) await loadProfile()
    return error
  }

  async function logOut() {
    await supabase.auth.signOut({ scope: 'local' })
    session.value = null
    profile.value = null
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
