import { AuthApiError, AuthRetryableFetchError, AuthUnknownError } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authErrorKey } from './errors'
import en from '../../i18n/en.json'

const api = (code: string, status = 400) => new AuthApiError('server message', status, code)

describe('authErrorKey', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['invalid_credentials', 'auth.errors.wrongLogin'],
    ['email_not_confirmed', 'auth.errors.notConfirmed'],
    ['user_already_exists', 'auth.errors.taken'],
    ['email_exists', 'auth.errors.taken'],
    ['weak_password', 'auth.errors.weakPassword'],
    ['same_password', 'auth.errors.samePassword'],
    ['reauthentication_needed', 'auth.errors.logInAgain'],
    ['session_not_found', 'auth.errors.logInAgain'],
    ['over_email_send_rate_limit', 'auth.errors.tooManyEmails'],
    ['over_request_rate_limit', 'auth.errors.tooManyTries'],
    ['email_address_invalid', 'auth.errors.badEmail'],
    ['otp_expired', 'auth.errors.linkExpired'],
  ])('%s has its own message', (code, key) => {
    expect(authErrorKey(api(code))).toBe(key)
  })

  it('says "check your connection" only when the request never reached the server', () => {
    expect(authErrorKey(new AuthRetryableFetchError('Failed to fetch', 0))).toBe('auth.errors.network')
    vi.stubGlobal('navigator', { onLine: false })
    expect(authErrorKey(api('unexpected_failure', 500))).toBe('auth.errors.network')
  })

  it('a server failure is not a connection problem', () => {
    expect(authErrorKey(api('unexpected_failure', 500))).toBe('auth.errors.server')
    expect(authErrorKey(new AuthRetryableFetchError('Bad gateway', 502))).toBe('auth.errors.server')
    expect(authErrorKey(new AuthUnknownError('bad json', null))).toBe('auth.errors.server')
  })

  it('when the request sends an email, a server failure says the email could not be sent', () => {
    expect(authErrorKey(api('unexpected_failure', 500), { sendsEmail: true })).toBe('auth.errors.emailNotSent')
    expect(authErrorKey(new AuthRetryableFetchError('Bad gateway', 503), { sendsEmail: true })).toBe(
      'auth.errors.emailNotSent',
    )
  })

  it('an unknown code gets a plain message, not "check your connection"', () => {
    expect(authErrorKey(api('some_new_code'))).toBe('auth.errors.generic')
    expect(en.auth.errors.generic).not.toMatch(/connection/i)
  })

  it('every key it returns has English text', () => {
    const errors = en.auth.errors as Record<string, string>
    for (const key of [
      'network',
      'server',
      'emailNotSent',
      'samePassword',
      'logInAgain',
      'tooManyEmails',
      'tooManyTries',
      'badEmail',
      'linkExpired',
      'generic',
    ])
      expect(errors[key], key).toBeTruthy()
  })
})
