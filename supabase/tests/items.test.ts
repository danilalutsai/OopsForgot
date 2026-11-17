import { describe, expect, it } from 'vitest'
import { signUpPerson } from './people.ts'

const passport = { name: 'Passport', category: 'documents', due_date: '2027-03-02' }

describe('Items', () => {
  it('a person adds an Item and sees it', async () => {
    const ana = await signUpPerson('Ana')
    const added = await ana.client.from('items').insert(passport).select('name, category, due_date').single()
    expect(added.error).toBeNull()
    const { data } = await ana.client.from('items').select('name, category, due_date')
    expect(data).toEqual([passport])
  })

  it("Ben cannot read, change or delete Ana's Items", async () => {
    const ana = await signUpPerson('Ana')
    const ben = await signUpPerson('Ben')
    const { data: item } = await ana.client.from('items').insert(passport).select('id').single()

    expect((await ben.client.from('items').select('id').eq('id', item!.id)).data).toEqual([])
    await ben.client.from('items').update({ name: 'Hacked' }).eq('id', item!.id)
    await ben.client.from('items').delete().eq('id', item!.id)

    const { data } = await ana.client.from('items').select('name')
    expect(data).toEqual([{ name: 'Passport' }])
  })

  it("Ben cannot add an Item into Ana's list", async () => {
    const ana = await signUpPerson('Ana')
    const ben = await signUpPerson('Ben')
    const { error } = await ben.client.from('items').insert({ ...passport, user_id: ana.id })
    expect(error).not.toBeNull()
    expect((await ana.client.from('items').select('id')).data).toEqual([])
  })

  it('an Item needs a name and a known Category', async () => {
    const ana = await signUpPerson('Ana')
    expect((await ana.client.from('items').insert({ ...passport, name: '  ' })).error).not.toBeNull()
    expect((await ana.client.from('items').insert({ ...passport, category: 'pets' })).error).not.toBeNull()
  })
})
