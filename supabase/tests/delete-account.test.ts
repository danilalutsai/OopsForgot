import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { anonymous, signUpPerson, signUpWithGoogle } from './people.ts'
import { query } from './db.ts'

const local = JSON.parse(
  execSync('pnpm exec supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(),
)
const password = 'correct-horse-battery'

async function deleteAccount(accessToken: string, body: object) {
  return fetch(`${local.API_URL}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: local.PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

async function anaWithData() {
  const ana = await signUpPerson('Ana')
  const { data: item } = await ana.client
    .from('items')
    .insert({ name: 'Passport', category: 'documents', due_date: '2030-01-01' })
    .select('id')
    .single()
  await ana.client
    .from('expenses')
    .insert({ amount_cents: 500, category: 'other', date: new Date().toISOString().slice(0, 10) })
  await ana.client
    .from('push_devices')
    .insert({ endpoint: `https://push.example.test/${crypto.randomUUID()}`, p256dh: 'k', auth: 'a' })
  await ana.client.storage
    .from('avatars')
    .upload(`${ana.id}/photo.jpg`, new Blob([new Uint8Array([1])], { type: 'image/jpeg' }))
  await ana.client.rpc('new_calendar_link')
  const session = (await ana.client.auth.getSession()).data.session!
  return { ana, itemId: item!.id, token: session.access_token }
}

describe('Delete account', () => {
  it('removes the account and everything of the person, keeping only the ID on the deleted list', async () => {
    const { ana, token } = await anaWithData()
    const res = await deleteAccount(token, { password, confirm: 'DELETE' })
    expect(res.status).toBe(200)

    for (const table of ['profiles', 'items', 'expenses', 'push_devices']) {
      const column = table === 'profiles' ? 'id' : 'user_id'
      const rows = await query(`select 1 from public.${table} where ${column} = '${ana.id}'`)
      expect(rows, table).toEqual([])
    }
    expect(await query(`select 1 from storage.objects where name like '${ana.id}/%'`)).toEqual([])
    expect(await query(`select 1 from public.deleted_accounts where user_id = '${ana.id}'`)).toHaveLength(1)
    const login = await anonymous().auth.signInWithPassword({ email: ana.email, password })
    expect(login.error).not.toBeNull()
  })

  it('needs the right password and the word DELETE', async () => {
    const { ana, token } = await anaWithData()
    expect((await deleteAccount(token, { password: 'wrong-password', confirm: 'DELETE' })).status).toBe(403)
    expect((await deleteAccount(token, { password, confirm: 'delete' })).status).toBe(400)
    expect(await query(`select 1 from public.profiles where id = '${ana.id}'`)).toHaveLength(1)
  })

  it('a Google-only person, just back from Google, deletes without a password', async () => {
    const ben = await signUpWithGoogle({ full_name: 'Ben Ortiz' })
    const token = (await ben.client.auth.getSession()).data.session!.access_token
    const res = await deleteAccount(token, { confirm: 'DELETE' })
    expect(res.status).toBe(200)
    expect(await query(`select 1 from public.profiles where id = '${ben.id}'`)).toEqual([])
  })

  it('a Google-only person signed in long ago must sign in with Google again first', async () => {
    const ben = await signUpWithGoogle({ full_name: 'Ben Ortiz' })
    // the session's sign-in happened an hour ago; a renewed token keeps that time
    await query(`update auth.mfa_amr_claims set created_at = now() - interval '1 hour', updated_at = now() - interval '1 hour'
                 where session_id in (select id from auth.sessions where user_id = '${ben.id}')`)
    const { data } = await ben.client.auth.refreshSession()
    const res = await deleteAccount(data.session!.access_token, { confirm: 'DELETE' })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'sign-in-again' })
    expect(await query(`select 1 from public.profiles where id = '${ben.id}'`)).toHaveLength(1)
  })

  it('cannot be called without a session', async () => {
    expect((await deleteAccount('not-a-token', { password, confirm: 'DELETE' })).status).toBe(401)
  })
})

describe('after deleting', () => {
  it("the person's Calendar feed link stops working", async () => {
    const { ana, token } = await anaWithData()
    const { data: link } = await ana.client.from('profiles').select('calendar_token').single()
    await deleteAccount(token, { password, confirm: 'DELETE' })
    const res = await fetch(`${local.API_URL}/functions/v1/calendar-feed?token=${link!.calendar_token}`)
    expect(res.status).toBe(404)
  })
})
