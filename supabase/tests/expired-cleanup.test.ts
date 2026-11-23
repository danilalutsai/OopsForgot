import { describe, expect, it } from 'vitest'
import { query } from './db.ts'
import { signUpPerson } from './people.ts'

/** The date `days` from today, as the database sees it in Tallinn. */
const day = async (days: number) =>
  (
    await query<{ d: string }>(
      `select to_char((now() at time zone 'Europe/Tallinn')::date + $1::int, 'YYYY-MM-DD') as d`,
      [days],
    )
  )[0]!.d

async function personWith(name: string) {
  const person = await signUpPerson(name)
  await query(`update public.profiles set time_zone = 'Europe/Tallinn' where id = $1`, [person.id])
  const add = async (label: string, dueDate: string, extra: object = {}) => {
    const { data, error } = await person.client
      .from('items')
      .insert({ name: label, category: 'other', due_date: dueDate, ...extra })
      .select('id')
      .single()
    expect(error).toBeNull()
    return data!.id as string
  }
  const names = async () =>
    ((await person.client.from('items').select('name').order('name')).data ?? []).map((i) => i.name)
  return { ...person, add, names }
}

const cleanUp = () => query('select public.delete_old_expired_items()')

describe('Expired clean-up', () => {
  it('deletes one-time Events Expired longer than the setting (1 month by default); Expenses stay', async () => {
    const ana = await personWith('Ana')
    const old = await ana.add('Old', await day(-32))
    await ana.add('Recent', await day(-20))
    await ana.add('Today', await day(0))
    await ana.add('Rent', await day(-100), { recurrence_unit: 'month', recurrence_every: 1 })
    await query(
      `insert into public.expenses (user_id, amount_cents, category, date, item_id, item_name)
       values ($1, 1000, 'other', $2, $3, 'Old')`,
      [ana.id, await day(-32), old],
    )

    await cleanUp()
    expect(await ana.names()).toEqual(['Recent', 'Rent', 'Today'])
    const { data: expenses } = await ana.client.from('expenses').select('item_id, item_name')
    expect(expenses).toEqual([{ item_id: null, item_name: 'Old' }])
  })

  it('follows the person’s choice: 1 week, 3 months, or never', async () => {
    const ana = await personWith('Ana')
    const ben = await personWith('Ben')
    for (const p of [ana, ben]) {
      await p.add('Ten days', await day(-10))
      await p.add('Fifty days', await day(-50))
    }
    expect((await ana.client.from('profiles').update({ expired_cleanup_days: 7 }).eq('id', ana.id)).error).toBeNull()
    expect((await ben.client.from('profiles').update({ expired_cleanup_days: null }).eq('id', ben.id)).error).toBeNull()

    await cleanUp()
    expect(await ana.names()).toEqual([])
    expect(await ben.names()).toEqual(['Fifty days', 'Ten days'])

    for (const days of [90, 180, 365]) {
      expect(
        (await ana.client.from('profiles').update({ expired_cleanup_days: days }).eq('id', ana.id)).error,
      ).toBeNull()
    }
    expect(
      (await ana.client.from('profiles').update({ expired_cleanup_days: 5 }).eq('id', ana.id)).error,
    ).not.toBeNull()
  })

  it('new people start with 1 month', async () => {
    const ana = await signUpPerson('Ana')
    const { data } = await ana.client.from('profiles').select('expired_cleanup_days').single()
    expect(data).toEqual({ expired_cleanup_days: 30 })
  })
})
