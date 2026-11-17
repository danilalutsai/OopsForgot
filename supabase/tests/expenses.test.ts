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

  it('refuses future dates, free trials, zero amounts and links to Items set by hand', async () => {
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
