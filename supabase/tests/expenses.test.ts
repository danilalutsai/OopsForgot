import { describe, expect, it } from 'vitest'
import { signUpPerson } from './people.ts'

const today = new Date().toISOString().slice(0, 10)
const groceries = { amount_cents: 6240, category: 'other', date: today, description: 'Groceries' }

describe('Expenses', () => {
  it('a person adds, changes and deletes their own Expense', async () => {
    const ana = await signUpPerson('Ana')
    const { data: added, error } = await ana.client.from('expenses').insert(groceries).select('id').single()
    expect(error).toBeNull()
    expect((await ana.client.from('expenses').update({ amount_cents: 7000 }).eq('id', added!.id)).error).toBeNull()
    await ana.client.from('expenses').delete().eq('id', added!.id)
    expect((await ana.client.from('expenses').select('id')).data).toEqual([])
  })

  it("Ben cannot read, change or delete Ana's Expenses", async () => {
    const ana = await signUpPerson('Ana')
    const ben = await signUpPerson('Ben')
    const { data: added } = await ana.client.from('expenses').insert(groceries).select('id').single()
    expect((await ben.client.from('expenses').select('id').eq('id', added!.id)).data).toEqual([])
    await ben.client.from('expenses').update({ amount_cents: 1 }).eq('id', added!.id)
    await ben.client.from('expenses').delete().eq('id', added!.id)
    expect((await ana.client.from('expenses').select('amount_cents')).data).toEqual([{ amount_cents: 6240 }])
  })

  it('refuses future dates, free trials, zero amounts and links to Events set by hand', async () => {
    const ana = await signUpPerson('Ana')
    const add = (changes: object) => ana.client.from('expenses').insert({ ...groceries, ...changes })
    expect((await add({ date: '2099-01-01' })).error).not.toBeNull()
    expect((await add({ category: 'free_trials' })).error).not.toBeNull()
    expect((await add({ amount_cents: 0 })).error).not.toBeNull()
    expect((await add({ item_name: 'Fake' })).error).not.toBeNull()
  })
})

describe('Expense Categories', () => {
  it('accepts every shared Category except Free trials', async () => {
    const { CATEGORIES } = await import('../../shared/src/index.ts')
    const ana = await signUpPerson('Ana')
    for (const category of CATEGORIES.filter((c) => c !== 'free_trials')) {
      const { error } = await ana.client.from('expenses').insert({ ...groceries, category })
      expect(error, category).toBeNull()
    }
  })
})

describe('Expenses from Events', () => {
  it('keeping a trial makes a monthly Subscription and records its first charge on the trial date', async () => {
    const ana = await signUpPerson('Ana')
    const { data: trial } = await ana.client
      .from('items')
      .insert({ name: 'Disney+ free trial', category: 'free_trials', due_date: today, price_cents: 999 })
      .select('id')
      .single()
    const { error } = await ana.client.rpc('keep_trial', {
      p_item_id: trial!.id,
      p_name: 'Disney+',
      p_reminders: ['1d'],
    })
    expect(error).toBeNull()
    const { data: item } = await ana.client.from('items').select('name, category, recurrence_unit').single()
    expect(item).toEqual({ name: 'Disney+', category: 'subscriptions', recurrence_unit: 'month' })
    const { data: spent } = await ana.client.from('expenses').select('amount_cents, date, item_name, category')
    expect(spent).toEqual([{ amount_cents: 999, date: today, item_name: 'Disney+', category: 'subscriptions' }])
  })

  it("Ben cannot keep Ana's trial", async () => {
    const ana = await signUpPerson('Ana')
    const ben = await signUpPerson('Ben')
    const { data: trial } = await ana.client
      .from('items')
      .insert({ name: 'Trial', category: 'free_trials', due_date: today })
      .select('id')
      .single()
    const { error } = await ben.client.rpc('keep_trial', { p_item_id: trial!.id, p_name: 'Mine', p_reminders: [] })
    expect(error).not.toBeNull()
  })

  it("an automatic Expense's Category can't be changed", async () => {
    const ana = await signUpPerson('Ana')
    const { data: trial } = await ana.client
      .from('items')
      .insert({ name: 'Trial', category: 'free_trials', due_date: today, price_cents: 500 })
      .select('id')
      .single()
    await ana.client.rpc('keep_trial', { p_item_id: trial!.id, p_name: 'Paid', p_reminders: [] })
    const { data: e } = await ana.client.from('expenses').select('id').single()
    expect((await ana.client.from('expenses').update({ category: 'other' }).eq('id', e!.id)).error).not.toBeNull()
    expect((await ana.client.from('expenses').update({ amount_cents: 600 }).eq('id', e!.id)).error).toBeNull()
  })
})

describe('automatic Expense dates', () => {
  it('cannot be moved into the future', async () => {
    const ana = await signUpPerson('Ana')
    const { data: trial } = await ana.client
      .from('items')
      .insert({ name: 'Trial', category: 'free_trials', due_date: today, price_cents: 500 })
      .select('id')
      .single()
    await ana.client.rpc('keep_trial', { p_item_id: trial!.id, p_name: 'Paid', p_reminders: [] })
    const { data: e } = await ana.client.from('expenses').select('id').single()
    expect((await ana.client.from('expenses').update({ date: '2099-01-01' }).eq('id', e!.id)).error).not.toBeNull()
  })

  it('a trial that has not ended yet cannot be kept', async () => {
    const ana = await signUpPerson('Ana')
    const { data: trial } = await ana.client
      .from('items')
      .insert({ name: 'Trial', category: 'free_trials', due_date: '2099-01-01', price_cents: 500 })
      .select('id')
      .single()
    const { error } = await ana.client.rpc('keep_trial', { p_item_id: trial!.id, p_name: 'Paid', p_reminders: [] })
    expect(error).not.toBeNull()
  })
})
