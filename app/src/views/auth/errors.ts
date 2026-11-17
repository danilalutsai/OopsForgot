import type { AuthError } from '@supabase/supabase-js'

/** Translation key for an auth error, by Supabase's error code. */
export function authErrorKey(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'auth.errors.wrongLogin'
    case 'email_not_confirmed':
      return 'auth.errors.notConfirmed'
    case 'user_already_exists':
    case 'email_exists':
      return 'auth.errors.taken'
    case 'weak_password':
      return 'auth.errors.weakPassword'
    default:
      return 'auth.errors.generic'
  }
}
