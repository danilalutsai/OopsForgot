import { describe, expect, it } from 'vitest'
import { query } from './db.ts'
import { anonymous, signUpPerson, signUpWithGoogle } from './people.ts'

const identities = (id: string) =>
  query<{ provider: string }>(`select provider from auth.identities where user_id = $1 order by provider`, [id])

async function googleWithPassword() {
  const ben = await signUpWithGoogle({ full_name: 'Ben Ortiz' })
  await ben.client.rpc('finish_signup', { name: 'Ben', surname: 'Ortiz' })
  return ben
}

describe('how a person logs in', () => {
  it('knows whether the account has a password, also after a Google-only person adds one', async () => {
    const ana = await signUpPerson('Ana')
    expect((await ana.client.rpc('has_password')).data).toBe(true)
    const ben = await googleWithPassword()
    expect((await ben.client.rpc('has_password')).data).toBe(false)
    expect((await ben.client.auth.updateUser({ password: 'another-good-password' })).error).toBeNull()
    expect((await ben.client.rpc('has_password')).data).toBe(true)
  })

  it('Google can be disconnected only once the account has a password', async () => {
    const ben = await googleWithPassword()
    expect((await ben.client.rpc('disconnect_google')).error).not.toBeNull()
    expect(await identities(ben.id)).toEqual([{ provider: 'google' }])

    await ben.client.auth.updateUser({ password: 'another-good-password' })
    expect((await ben.client.rpc('disconnect_google')).error).toBeNull()
    expect(await identities(ben.id)).toEqual([])
    const again = await anonymous().auth.signInWithPassword({ email: ben.email, password: 'another-good-password' })
    expect(again.error).toBeNull()
  })

  it("disconnecting touches only the person's own Google", async () => {
    const ana = await signUpPerson('Ana')
    const ben = await googleWithPassword()
    await ana.client.rpc('disconnect_google')
    expect(await identities(ben.id)).toEqual([{ provider: 'google' }])
  })
})

describe('log out everywhere', () => {
  it("ends the person's other sessions and removes all their devices", async () => {
    const ana = await signUpPerson('Ana')
    const other = anonymous()
    await other.auth.signInWithPassword({ email: ana.email, password: 'correct-horse-battery' })
    await ana.client
      .from('push_devices')
      .insert({ endpoint: `https://push.example.test/${crypto.randomUUID()}`, p256dh: 'k', auth: 'a' })

    expect((await ana.client.from('push_devices').delete().eq('user_id', ana.id)).error).toBeNull()
    expect((await ana.client.auth.signOut({ scope: 'global' })).error).toBeNull()

    expect((await other.auth.refreshSession()).error).not.toBeNull()
    expect(await query(`select 1 from public.push_devices where user_id = $1`, [ana.id])).toEqual([])
  })
})
