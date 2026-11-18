import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const local = JSON.parse(
  execSync('pnpm exec supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(),
)
const call = (fn: string, key?: string) =>
  fetch(`${local.API_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: '{}',
  })

// The cron calls these with the server key kept in Vault: either form of it must work
// (the older JWT "service_role" key or the newer "sb_secret_" key), and nothing else.
describe.each(['send-reminders', 'account-cleanup'])('%s', (fn) => {
  it('accepts the server key in its older form', async () => {
    expect((await call(fn, local.SERVICE_ROLE_KEY)).status).not.toBe(403)
  })
  it('accepts the server key in its newer form', async () => {
    expect((await call(fn, local.SECRET_KEY)).status).not.toBe(403)
  })
  it('refuses the public key, a made-up key, and no key', async () => {
    for (const key of [local.PUBLISHABLE_KEY, local.ANON_KEY, 'sb_secret_made-up', undefined]) {
      expect((await call(fn, key)).status, String(key).slice(0, 12)).toBe(403)
    }
  })
})
