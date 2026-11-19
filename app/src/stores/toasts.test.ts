import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '../i18n/en.json'

const SRC = join(__dirname, '..')

/** Every message key the app passes to toasts.show, found in the source. */
function toastKeys() {
  const keys = new Set<string>()
  for (const file of readdirSync(SRC, { recursive: true, encoding: 'utf8' })) {
    if (!/\.(ts|vue)$/.test(file) || file.endsWith('.test.ts')) continue
    const code = readFileSync(join(SRC, file), 'utf8')
    for (const call of code.matchAll(/toasts\.show\(([^)]*)/g))
      for (const [, key] of (call[1] ?? '').matchAll(/'([a-zA-Z]+(?:\.[a-zA-Z]+)+)'/g)) if (key) keys.add(key)
  }
  return [...keys]
}

const text = (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], en)

describe('toast messages', () => {
  it('are found in the source', () => {
    expect(toastKeys()).toEqual(expect.arrayContaining(['toasts.handled', 'toasts.unhandled', 'items.restored']))
  })

  it('all have English text without emoji', () => {
    for (const key of toastKeys()) {
      const message = text(key)
      expect(typeof message, key).toBe('string')
      expect(message, key).not.toMatch(/\p{Extended_Pictographic}/u)
    }
  })
})
