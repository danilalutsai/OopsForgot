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

describe('repeating Items', () => {
  it('stores how often an Item repeats', async () => {
    const ana = await signUpPerson('Ana')
    const rent = {
      name: 'Rent',
      category: 'home',
      due_date: '2026-10-01',
      recurrence_unit: 'month',
      recurrence_every: 1,
    }
    expect((await ana.client.from('items').insert(rent)).error).toBeNull()
  })

  it('refuses half a Recurrence or an unknown unit', async () => {
    const ana = await signUpPerson('Ana')
    expect((await ana.client.from('items').insert({ ...passport, recurrence_unit: 'month' })).error).not.toBeNull()
    expect(
      (await ana.client.from('items').insert({ ...passport, recurrence_unit: 'decade', recurrence_every: 1 })).error,
    ).not.toBeNull()
  })
})

describe('Handled and Archived', () => {
  it('a person marks an Item Handled for a Due date, archives and restores it', async () => {
    const ana = await signUpPerson('Ana')
    const { data: item } = await ana.client.from('items').insert(passport).select('id').single()
    const set = (changes: object) => ana.client.from('items').update(changes).eq('id', item!.id).select('id')
    expect((await set({ handled_due_date: '2027-03-02' })).data).toHaveLength(1)
    expect((await set({ archived_at: new Date().toISOString() })).data).toHaveLength(1)
    expect((await set({ archived_at: null })).data).toHaveLength(1)
  })

  it('a deleted Item can be put back with the same id (Undo)', async () => {
    const ana = await signUpPerson('Ana')
    const { data: item } = await ana.client.from('items').insert(passport).select('*').single()
    await ana.client.from('items').delete().eq('id', item!.id)
    const { user_id: _owner, created_at: _created, ...back } = item!
    expect((await ana.client.from('items').insert(back)).error).toBeNull()
    expect((await ana.client.from('items').select('id')).data).toEqual([{ id: item!.id }])
  })
})
