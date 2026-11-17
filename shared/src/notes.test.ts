import { expect, it } from 'vitest'
import { looksLikeFullNumber } from './notes.ts'

it('warns about 8 or more digits in a row, like a card or document number', () => {
  expect(looksLikeFullNumber('card 4111111111111111')).toBe(true)
  expect(looksLikeFullNumber('passport no. 12345678')).toBe(true)
})

it('also warns when the digits are grouped with spaces or dashes', () => {
  expect(looksLikeFullNumber('card 4111 1111 1111 1111')).toBe(true)
  expect(looksLikeFullNumber('IBAN ES91 2100 0418 4502')).toBe(true)
  expect(looksLikeFullNumber('ref 1234-5678')).toBe(true)
})

it('does not warn about short numbers', () => {
  expect(looksLikeFullNumber('last 4: 1234, renew by 2027')).toBe(false)
  expect(looksLikeFullNumber('room 12, floor 3')).toBe(false)
})
