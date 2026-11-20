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

describe('Start and Finish time', () => {
  it('an Item can have a Start time and a later Finish time on the same day', async () => {
    const ana = await signUpPerson('Ana')
    const dentist = { ...passport, name: 'Dentist', due_time: '09:00', finish_time: '10:30' }
    const { data, error } = await ana.client.from('items').insert(dentist).select('due_time, finish_time').single()
    expect(error).toBeNull()
    expect(data).toEqual({ due_time: '09:00:00', finish_time: '10:30:00' })
  })

  it('refuses a Finish time without a Start time, or not after it', async () => {
    const ana = await signUpPerson('Ana')
    const at = (due_time: string | null, finish_time: string) =>
      ana.client.from('items').insert({ ...passport, due_time, finish_time })
    expect((await at(null, '10:00')).error).not.toBeNull()
    expect((await at('10:00', '10:00')).error).not.toBeNull()
    expect((await at('10:00', '09:00')).error).not.toBeNull()
    expect((await ana.client.from('items').select('id')).data).toEqual([])
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

describe('Handled, Keep in Expired and Delete', () => {
  it('a person marks an Item Handled, or keeps it in Expired, for a Event date', async () => {
    const ana = await signUpPerson('Ana')
    const { data: item } = await ana.client.from('items').insert(passport).select('id').single()
    const set = (changes: object) => ana.client.from('items').update(changes).eq('id', item!.id).select('id')
    expect((await set({ handled_due_date: '2027-03-02' })).data).toHaveLength(1)
    expect((await set({ kept_expired_due_date: '2027-03-02' })).data).toHaveLength(1)
  })

  it('Items are no longer archived: the column is gone', async () => {
    const ana = await signUpPerson('Ana')
    expect((await ana.client.from('items').select('archived_at')).error).not.toBeNull()
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

describe('Reminders on Items', () => {
  it('a new Item gets a Reminder 1 day before; the person can change them', async () => {
    const ana = await signUpPerson('Ana')
    const { data: item } = await ana.client.from('items').insert(passport).select('id, reminder_offsets').single()
    expect(item!.reminder_offsets).toEqual(['1d'])
    const { error } = await ana.client
      .from('items')
      .update({ reminder_offsets: ['1w', '1M'] })
      .eq('id', item!.id)
    expect(error).toBeNull()
  })

  it('refuses Reminder choices that do not exist', async () => {
    const ana = await signUpPerson('Ana')
    const { error } = await ana.client.from('items').insert({ ...passport, reminder_offsets: ['3d'] })
    expect(error).not.toBeNull()
  })
})
