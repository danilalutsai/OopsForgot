import { describe, expect, it } from 'vitest'
import { parseAmount } from './money.ts'

describe('parseAmount', () => {
  it('reads an amount with a dot or a comma into whole cents', () => {
    expect(parseAmount('12.50')).toBe(1250)
    expect(parseAmount('12,5')).toBe(1250)
    expect(parseAmount(' 420 ')).toBe(42000)
  })

  it('refuses zero, negatives, more than 2 decimals and text', () => {
    expect(parseAmount('0')).toBeNull()
    expect(parseAmount('-5')).toBeNull()
    expect(parseAmount('1.234')).toBeNull()
    expect(parseAmount('ten')).toBeNull()
    expect(parseAmount('1,000.00')).toBeNull()
  })
})
