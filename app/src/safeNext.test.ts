import { describe, expect, it } from 'vitest'
import { safeNext } from './safeNext'

describe('safeNext', () => {
  it('keeps pages inside the app', () => {
    expect(safeNext('/money')).toBe('/money')
    expect(safeNext('/?item=1')).toBe('/?item=1')
  })
  it('never sends anyone to another site', () => {
    for (const bad of ['//evil.test', '/\\evil.test', 'https://evil.test', undefined, ['/a']]) {
      expect(safeNext(bad)).toBe('/')
    }
  })
})
