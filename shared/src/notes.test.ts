import { expect, it } from 'vitest'
import { looksLikeFullNumber } from './notes.ts'

it('warns about 8 or more digits in a row, like a card or document number', () => {
  expect(looksLikeFullNumber('card 4111111111111111')).toBe(true)
  expect(looksLikeFullNumber('passport no. 12345678')).toBe(true)
})

it('does not warn about shorter numbers or digits split by spaces', () => {
  expect(looksLikeFullNumber('last 4: 1234, renew by 2027')).toBe(false)
  expect(looksLikeFullNumber('call 555 1234 567')).toBe(false)
})
