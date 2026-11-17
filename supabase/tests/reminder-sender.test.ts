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
    expect(sent[0]!.message.title).toBe('Ana, Netflix is due tomorrow 🔔')
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
    expect(sent[0]!.message.title).toBe('Ana, 2 Items need you soon 🔔')
  })

  it('stops for Handled and Archived Items, and starts again on the next Due date', async () => {
    const { ana, items } = await personWith([
      { ...base, name: 'Rent', due_date: '2030-04-10', recurrence_unit: 'month', recurrence_every: 1 },
      { ...base, name: 'Old gym', due_date: '2030-04-10' },
    ])
    await ana.client.from('items').update({ handled_due_date: '2030-04-10' }).eq('id', items[0]!.id)
    await ana.client.from('items').update({ archived_at: new Date().toISOString() }).eq('id', items[1]!.id)
    expect(forAna(await runSender('2030-04-09T09:45:00Z', '2030-04-09T10:00:00Z'), ana.id)).toHaveLength(0)
    // May is summer time in Tallinn (UTC+3): 12:00 there is 09:00 UTC
    const next = forAna(await runSender('2030-05-09T08:45:00Z', '2030-05-09T09:00:00Z'), ana.id)
    expect(next.map((s) => s.message.title)).toEqual(['Ana, Rent is due tomorrow 🔔'])
  })

  it("still sends a late Reminder after skipped runs, while the Due date hasn't passed", async () => {
    const { ana } = await personWith([{ ...base, name: 'Car insurance', due_date: '2030-06-10' }])
    const late = forAna(await runSender('2030-06-09T08:00:00Z', '2030-06-09T15:00:00Z'), ana.id)
    expect(late.map((s) => s.message.title)).toEqual(['Ana, Car insurance is due tomorrow 🔔'])
  })
})

describe('automatic Expenses', () => {
  it('a priced Item creates one Expense on its Due date; a deleted one never comes back', async () => {
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

  it('free trials and Items without a price create none', async () => {
    const { ana } = await personWith([
      { ...base, name: 'Trial', category: 'free_trials', due_date: '2030-08-10', price_cents: 999 },
      { ...base, name: 'Passport', category: 'documents', due_date: '2030-08-10' },
    ])
    await runSender('2030-08-10T09:45:00Z', '2030-08-10T10:00:00Z')
    expect((await ana.client.from('expenses').select('id')).data).toEqual([])
  })
})
