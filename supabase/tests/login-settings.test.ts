import { describe, expect, it } from 'vitest'
import { query } from './db.ts'
import { callFunction, signedInLongAgo } from './functions.ts'
import { anonymous, signUpPerson, signUpWithGoogle } from './people.ts'

const password = 'correct-horse-battery'
const canLogIn = async (email: string, pw: string) =>
  !(await anonymous().auth.signInWithPassword({ email, password: pw })).error

async function googleOnly() {
  const ben = await signUpWithGoogle({ full_name: 'Ben Ortiz' })
  await ben.client.rpc('finish_signup', { name: 'Ben', surname: 'Ortiz' })
  return ben
}

describe('has_password', () => {
  it('knows whether the account has a password, also after a Google-only person adds one', async () => {
    const ana = await signUpPerson('Ana')
    expect((await ana.client.rpc('has_password')).data).toBe(true)
    const ben = await googleOnly()
    expect((await ben.client.rpc('has_password')).data).toBe(false)
    await callFunction('change-password', ben, { password: 'another-good-password' })
    expect((await ben.client.rpc('has_password')).data).toBe(true)
  })
})

describe('change-password', () => {
  it('changes the password only with the current one', async () => {
    const ana = await signUpPerson('Ana')
    const wrong = await callFunction('change-password', ana, {
      current: 'nope-nope-nope',
      password: 'brand-new-password',
    })
    expect(wrong.status).toBe(403)
    expect(await wrong.json()).toEqual({ error: 'password' })
    expect((await callFunction('change-password', ana, { password: 'brand-new-password' })).status).toBe(403)
    expect(await canLogIn(ana.email, password)).toBe(true)

    const ok = await callFunction('change-password', ana, { current: password, password: 'brand-new-password' })
    expect(ok.status).toBe(200)
    expect(await canLogIn(ana.email, 'brand-new-password')).toBe(true)
  })

  it('ends every session of the person, so a stolen one stops working', async () => {
    const ana = await signUpPerson('Ana')
    const other = anonymous()
    await other.auth.signInWithPassword({ email: ana.email, password })
    expect(
      (await callFunction('change-password', ana, { current: password, password: 'brand-new-password' })).status,
    ).toBe(200)
    expect((await other.auth.refreshSession()).error).not.toBeNull()
  })

  it('refuses a short password', async () => {
    const ana = await signUpPerson('Ana')
    const res = await callFunction('change-password', ana, { current: password, password: 'short' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'weak' })
  })

  it('a Google-only person adds a first password right after signing in with Google', async () => {
    const ben = await googleOnly()
    expect((await callFunction('change-password', ben, { password: 'another-good-password' })).status).toBe(200)
    expect(await canLogIn(ben.email, 'another-good-password')).toBe(true)
  })

  it('a stale Google session cannot add a password', async () => {
    const ben = await googleOnly()
    await signedInLongAgo(ben)
    const res = await callFunction('change-password', ben, { password: 'another-good-password' })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'sign-in-again' })
    expect((await ben.client.rpc('has_password')).data).toBe(false)
  })
})

describe('log-out-everywhere', () => {
  it("ends every session of the person and removes all their devices, and nobody else's", async () => {
    const ana = await signUpPerson('Ana')
    const other = anonymous()
    await other.auth.signInWithPassword({ email: ana.email, password })
    const cleo = await signUpPerson('Cleo')
    for (const p of [ana, cleo]) {
      await p.client
        .from('push_devices')
        .insert({ endpoint: `https://push.example.test/${crypto.randomUUID()}`, p256dh: 'k', auth: 'a' })
    }

    expect((await callFunction('log-out-everywhere', ana)).status).toBe(200)

    expect((await other.auth.refreshSession()).error).not.toBeNull()
    expect(await query(`select 1 from public.push_devices where user_id = $1`, [ana.id])).toEqual([])
    expect(await query(`select 1 from public.push_devices where user_id = $1`, [cleo.id])).toHaveLength(1)
    expect((await cleo.client.auth.refreshSession()).error).toBeNull()
  })
})
