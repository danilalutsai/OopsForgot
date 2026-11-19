import { isAuthRetryableFetchError, type AuthError } from '@supabase/supabase-js'

/**
 * The error Supabase puts in the address when an email link fails (expired or already used).
 * Read once at start, before the router moves on to the login page and the address is gone.
 */
let linkError =
  typeof location === 'undefined'
    ? null
    : (new URLSearchParams(location.hash.slice(1)).get('error_code') ??
      new URLSearchParams(location.search).get('error_code'))

/** The message for a failed email link, once. */
export function takeLinkError(): string | null {
  const code = linkError
  linkError = null
  return code ? authErrorKey({ code, status: 403 } as AuthError) : null
}

/** Translation key for an auth error, by Supabase's error code (https://supabase.com/docs/guides/auth/debugging/error-codes). */
export function authErrorKey(error: AuthError, { sendsEmail = false } = {}): string {
  // "check your connection" only when the request never reached the server
  if ((isAuthRetryableFetchError(error) && error.status === 0) || navigator.onLine === false)
    return 'auth.errors.network'
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
    case 'same_password':
      return 'auth.errors.samePassword'
    case 'reauthentication_needed':
    case 'session_not_found':
    case 'session_expired':
      return 'auth.errors.logInAgain'
    case 'over_email_send_rate_limit':
      return 'auth.errors.tooManyEmails'
    case 'over_request_rate_limit':
      return 'auth.errors.tooManyTries'
    case 'email_address_invalid':
      return 'auth.errors.badEmail'
    case 'otp_expired':
      return 'auth.errors.linkExpired'
  }
  // the server failed (5xx, unexpected_failure, or an answer it couldn't read): when the request
  // sends an email (sign-up, reset link, email change), that is almost always the email failing
  if (!error.status || error.status >= 500 || error.code === 'unexpected_failure')
    return sendsEmail ? 'auth.errors.emailNotSent' : 'auth.errors.server'
  return 'auth.errors.generic'
}
