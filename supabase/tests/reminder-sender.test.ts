import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { signUpPerson } from './people.ts'

// The sender runs as a local Edge Function in test mode: a fake clock ("now", "from") and a fake
// push service that only reports what it would send. Start it with `pnpm functions:serve`.
const local = JSON.parse(
  execSync('pnpm exec supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(),
)

interface Sent {
  userId: string
  message: { title: string; body: string; url: string }
  entries: { item_id: string; due_date: string; kind: string }[]
  delivered: string[]
}

async function runSender(from: string, now: string): Promise<Sent[]> {
  const res = await fetch(`${local.API_URL}/functions/v1/send-reminders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${local.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, now }),
  })
  if (!res.ok) throw new Error(`sender answered ${res.status}: ${await res.text()}`)
  return (await res.json()).sent
}

/** A person in Tallinn (UTC+2 in November) with one push device and the given Items. */
async function personWith(items: object[]) {
  const ana = await signUpPerson('Ana', 'Tester', { time_zone: 'Europe/Tallinn' })
  await ana.client.from('push_devices').insert({
    endpoint: `https://push.example.test/${crypto.randomUUID()}`,
    p256dh: 'BKey',
    auth: 'secret',
    label: 'Test phone',
  })
  const { data, error } = await ana.client.from('items').insert(items).select('id, name')
  if (error) throw error
  return { ana, items: data! }
}

const forAna = (sent: Sent[], id: string) => sent.filter((s) => s.userId === id)
const base = { category: 'subscriptions' }

describe('Reminder sender', () => {
  it("sends a day Reminder at the right moment, to the person's device, with no price", async () => {
    // every test makes Items due far in the future, so other tests' data never falls in its windows
    const { ana } = await personWith([{ ...base, name: 'Netflix', due_date: '2030-01-10', price_cents: 1399 }])
    const sent = forAna(await runSender('2030-01-09T09:45:00Z', '2030-01-09T10:00:00Z'), ana.id)
    expect(sent).toHaveLength(1)
    expect(sent[0]!.message.title).toBe('Ana, Netflix is tomorrow 🔔')
    expect(sent[0]!.message.body).not.toContain('13.99')
    expect(sent[0]!.delivered).toHaveLength(1)
  })

  it('sends each Reminder only once, even if it runs twice over the same 15 minutes', async () => {
    const { ana } = await personWith([{ ...base, name: 'Gym', due_date: '2030-02-10' }])
    const first = forAna(await runSender('2030-02-09T09:45:00Z', '2030-02-09T10:00:00Z'), ana.id)
    const again = forAna(await runSender('2030-02-09T09:45:00Z', '2030-02-09T10:00:00Z'), ana.id)
    expect(first).toHaveLength(1)
    expect(again).toHaveLength(0)
  })

  it("bundles a person's Reminders into one message", async () => {
    const { ana } = await personWith([
      { ...base, name: 'Netflix', due_date: '2030-03-10' },
      { ...base, name: 'Spotify', due_date: '2030-03-10' },
    ])
    const sent = forAna(await runSender('2030-03-09T09:45:00Z', '2030-03-09T10:00:00Z'), ana.id)
    expect(sent).toHaveLength(1)
    expect(sent[0]!.message.title).toBe('Ana, 2 Events need you soon 🔔')
  })

  it('stops for Handled Events, and starts again on the next Event date', async () => {
    const { ana, items } = await personWith([
      { ...base, name: 'Rent', due_date: '2030-04-10', recurrence_unit: 'month', recurrence_every: 1 },
    ])
    await ana.client.from('items').update({ handled_due_date: '2030-04-10' }).eq('id', items[0]!.id)
    expect(forAna(await runSender('2030-04-09T09:45:00Z', '2030-04-09T10:00:00Z'), ana.id)).toHaveLength(0)
    // May is summer time in Tallinn (UTC+3): 12:00 there is 09:00 UTC
    const next = forAna(await runSender('2030-05-09T08:45:00Z', '2030-05-09T09:00:00Z'), ana.id)
    expect(next.map((s) => s.message.title)).toEqual(['Ana, Rent is tomorrow 🔔'])
  })

  it('sends no "What now?" for an Event kept in Expired', async () => {
    const { ana, items } = await personWith([
      { ...base, name: 'Old gym', due_date: '2030-04-10', reminder_offsets: [] },
    ])
    await ana.client.from('items').update({ kept_expired_due_date: '2030-04-10' }).eq('id', items[0]!.id)
    expect(forAna(await runSender('2030-04-11T08:45:00Z', '2030-04-11T09:00:00Z'), ana.id)).toHaveLength(0)
  })

  it('sends a day Reminder of an Event with a Start time at that time, the day before', async () => {
    const { ana } = await personWith([{ ...base, name: 'Dentist', due_date: '2030-03-10', due_time: '16:50' }])
    // March is winter time in Tallinn (UTC+2): 16:50 there is 14:50 UTC, not 12:00 local
    expect(forAna(await runSender('2030-03-09T09:45:00Z', '2030-03-09T10:00:00Z'), ana.id)).toHaveLength(0)
    const sent = forAna(await runSender('2030-03-09T14:45:00Z', '2030-03-09T15:00:00Z'), ana.id)
    expect(sent.map((s) => s.message.title)).toEqual(['Ana, Dentist is tomorrow at 16:50 🔔'])
  })

  it("still sends a late Reminder after skipped runs, while the Event date hasn't passed", async () => {
    const { ana } = await personWith([{ ...base, name: 'Car insurance', due_date: '2030-06-10' }])
    const late = forAna(await runSender('2030-06-09T08:00:00Z', '2030-06-09T15:00:00Z'), ana.id)
    expect(late.map((s) => s.message.title)).toEqual(['Ana, Car insurance is tomorrow 🔔'])
  })
})

describe('automatic Expenses', () => {
  it('a priced Event creates one Expense on its Event date; a deleted one never comes back', async () => {
    const { ana } = await personWith([{ ...base, name: 'Rent', due_date: '2030-07-10', price_cents: 75000 }])
    await runSender('2030-07-10T09:45:00Z', '2030-07-10T10:00:00Z')
    await runSender('2030-07-10T10:00:00Z', '2030-07-10T10:15:00Z')
    const { data } = await ana.client.from('expenses').select('id, amount_cents, date, item_name, category')
    expect(data!.map(({ id: _id, ...e }) => e)).toEqual([
      { amount_cents: 75000, date: '2030-07-10', item_name: 'Rent', category: 'subscriptions' },
    ])
    await ana.client.from('expenses').delete().eq('id', data![0]!.id)
    await runSender('2030-07-10T10:15:00Z', '2030-07-10T10:30:00Z')
    expect((await ana.client.from('expenses').select('id')).data).toEqual([])
  })

  it('free trials and Events without a price create none', async () => {
    const { ana } = await personWith([
      { ...base, name: 'Trial', category: 'free_trials', due_date: '2030-08-10', price_cents: 999 },
      { ...base, name: 'Passport', category: 'documents', due_date: '2030-08-10' },
    ])
    await runSender('2030-08-10T09:45:00Z', '2030-08-10T10:00:00Z')
    expect((await ana.client.from('expenses').select('id')).data).toEqual([])
  })
})

describe('automatic Expenses never fill in the past', () => {
  it('adding a price later starts from the next Event date', async () => {
    const { ana, items } = await personWith([
      { ...base, name: 'Rent', due_date: '2030-09-01', recurrence_unit: 'month', recurrence_every: 1 },
    ])
    await runSender('2030-11-05T09:45:00Z', '2030-11-05T10:00:00Z')
    await ana.client.from('items').update({ price_cents: 75000 }).eq('id', items[0]!.id)
    await runSender('2030-12-01T09:45:00Z', '2030-12-01T10:00:00Z')
    const { data } = await ana.client.from('expenses').select('date')
    expect(data).toEqual([{ date: '2030-12-01' }])
  })
})
