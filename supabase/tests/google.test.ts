import { describe, expect, it } from 'vitest'
import { signUpPerson, signUpWithGoogle } from './people.ts'

const profileOf = async (client: Awaited<ReturnType<typeof signUpPerson>>['client']) =>
  (await client.from('profiles').select('name, surname, confirmed_16_plus_at').single()).data

describe('Google signup', () => {
  it("fills Name and Surname from Google, and waits for the person's 16+ confirmation", async () => {
    const ana = await signUpWithGoogle({ full_name: 'Ana García López', avatar_url: 'https://example.test/a.jpg' })
    expect(await profileOf(ana.client)).toEqual({ name: 'Ana', surname: 'García López', confirmed_16_plus_at: null })
  })

  it("uses Google's given and family name when Google sends them", async () => {
    const ana = await signUpWithGoogle({ full_name: 'Ana María Ruiz', given_name: 'Ana María', family_name: 'Ruiz' })
    expect(await profileOf(ana.client)).toMatchObject({ name: 'Ana María', surname: 'Ruiz' })
  })

  it('still makes the account when Google has only one name', async () => {
    const cher = await signUpWithGoogle({ full_name: 'Cher' })
    expect(await profileOf(cher.client)).toMatchObject({ name: 'Cher', surname: '' })
  })

  it('finishing signup saves the checked names and the 16+ confirmation', async () => {
    const cher = await signUpWithGoogle({ full_name: 'Cher' })
    const { error } = await cher.client.rpc('finish_signup', { name: ' Cher ', surname: 'Sarkisian' })
    expect(error).toBeNull()
    const profile = await profileOf(cher.client)
    expect(profile).toMatchObject({ name: 'Cher', surname: 'Sarkisian' })
    expect(profile?.confirmed_16_plus_at).not.toBeNull()
  })

  it('finishing signup needs both names', async () => {
    const cher = await signUpWithGoogle({ full_name: 'Cher' })
    const { error } = await cher.client.rpc('finish_signup', { name: 'Cher', surname: '  ' })
    expect(error).not.toBeNull()
    expect((await profileOf(cher.client))?.confirmed_16_plus_at).toBeNull()
  })

  it('a confirmed person cannot clear their names', async () => {
    const ana = await signUpPerson('Ana')
    const { error } = await ana.client.from('profiles').update({ surname: '' }).eq('id', ana.id)
    expect(error).not.toBeNull()
  })

  it("Google's given name alone leaves the rest of the full name as the surname", async () => {
    const ana = await signUpWithGoogle({ full_name: 'Ana María Ruiz', given_name: 'Ana María' })
    expect(await profileOf(ana.client)).toMatchObject({ name: 'Ana María', surname: 'Ruiz' })
  })

  it('nothing can be saved before the 16+ confirmation, and everything after', async () => {
    const ben = await signUpWithGoogle({ full_name: 'Ben Ortiz' })
    const item = { name: 'Passport', category: 'documents', due_date: '2030-01-01' }
    const expense = { amount_cents: 500, category: 'other', date: '2026-01-01' }
    expect((await ben.client.from('items').insert(item)).error).not.toBeNull()
    expect((await ben.client.from('expenses').insert(expense)).error).not.toBeNull()
    const push = await ben.client.rpc('claim_push_device', {
      p_endpoint: `https://push.example.test/${crypto.randomUUID()}`,
      p_p256dh: 'k',
      p_auth: 'a',
      p_label: 'Phone',
    })
    expect(push.error).not.toBeNull()

    await ben.client.rpc('finish_signup', { name: 'Ben', surname: 'Ortiz' })
    expect((await ben.client.from('items').insert(item)).error).toBeNull()
    expect((await ben.client.from('expenses').insert(expense)).error).toBeNull()
  })
})
