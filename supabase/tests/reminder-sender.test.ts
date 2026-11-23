import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { signUpPerson } from './people.ts'

// The sender runs as a local Edge Function in test mode: a fake clock ("now", "from") and a fake
// push service that only reports what it would send. Start it with `pnpm functions:serve`.
const local = JSON.parse(
  execSync('pnpm exec supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(),
)

interface Message {
  title: string
  body: string
  url: string
  tag: string
}
interface Sent {
  userId: string
  /** one push per Event */
  messages: Message[]
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
    expect(sent[0]!.messages.map((m) => m.title)).toEqual(['Ana, Netflix is tomorrow 🔔'])
    expect(sent[0]!.messages[0]!.body).not.toContain('13.99')
    expect(sent[0]!.delivered).toHaveLength(1)
  })

  it('sends each Reminder only once, even if it runs twice over the same 15 minutes', async () => {
    const { ana } = await personWith([{ ...base, name: 'Gym', due_date: '2030-02-10' }])
    const first = forAna(await runSender('2030-02-09T09:45:00Z', '2030-02-09T10:00:00Z'), ana.id)
    const again = forAna(await runSender('2030-02-09T09:45:00Z', '2030-02-09T10:00:00Z'), ana.id)
    expect(first).toHaveLength(1)
    expect(again).toHaveLength(0)
  })

  it('sends each Event due at once as its own push, opening that Event', async () => {
    const { ana } = await personWith([
      { ...base, name: 'Netflix', due_date: '2030-03-10' },
      { ...base, name: 'Spotify', due_date: '2030-03-10' },
    ])
    const sent = forAna(await runSender('2030-03-09T09:45:00Z', '2030-03-09T10:00:00Z'), ana.id)
    expect(sent).toHaveLength(1)
    const messages = sent[0]!.messages
    expect(messages.map((m) => m.title).sort()).toEqual(['Ana, Netflix is tomorrow 🔔', 'Ana, Spotify is tomorrow 🔔'])
    expect(messages.every((m) => /^\/\?item=[0-9a-f-]{36}$/.test(m.url))).toBe(true)
    expect(new Set(messages.map((m) => m.url)).size).toBe(2)
  })

  it('stops for Handled Events, and starts again on the next Event date', async () => {
    const { ana, items } = await personWith([
      { ...base, name: 'Rent', due_date: '2030-04-10', recurrence_unit: 'month', recurrence_every: 1 },
    ])
    await ana.client.from('items').update({ handled_due_date: '2030-04-10' }).eq('id', items[0]!.id)
    expect(forAna(await runSender('2030-04-09T09:45:00Z', '2030-04-09T10:00:00Z'), ana.id)).toHaveLength(0)
    // May is summer time in Tallinn (UTC+3): 12:00 there is 09:00 UTC
    const next = forAna(await runSender('2030-05-09T08:45:00Z', '2030-05-09T09:00:00Z'), ana.id)
    expect(next.flatMap((s) => s.messages.map((m) => m.title))).toEqual(['Ana, Rent is tomorrow 🔔'])
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
    expect(sent.flatMap((s) => s.messages.map((m) => m.title))).toEqual(['Ana, Dentist is tomorrow at 16:50 🔔'])
  })

  it("still sends a late Reminder after skipped runs, while the Event date hasn't passed", async () => {
    const { ana } = await personWith([{ ...base, name: 'Car insurance', due_date: '2030-06-10' }])
    const late = forAna(await runSender('2030-06-09T08:00:00Z', '2030-06-09T15:00:00Z'), ana.id)
    expect(late.flatMap((s) => s.messages.map((m) => m.title))).toEqual(['Ana, Car insurance is tomorrow 🔔'])
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

// March 2030 is winter time in Tallinn (UTC+2): 14:30 there is 12:30 UTC.
describe('Reminders are re-armed when an Event moves', () => {
  const dentist = { ...base, name: 'Dentist', due_date: '2030-03-20', due_time: '15:00', reminder_offsets: ['30m'] }
  const titles = (sent: Sent[], id: string) => forAna(sent, id).flatMap((s) => s.messages.map((m) => m.title))

  it('moving the Start time later the same day sends the Reminder again at the new moment', async () => {
    const { ana, items } = await personWith([dentist])
    const set = (changes: object) => ana.client.from('items').update(changes).eq('id', items[0]!.id)
    // 30 min before 15:00
    expect(titles(await runSender('2030-03-20T12:15:00Z', '2030-03-20T12:30:00Z'), ana.id)).toEqual([
      'Ana, Dentist is today at 15:00 🔔',
    ])

    await set({ due_time: '17:35' })
    // 30 min before 17:35 is 17:05 local, 15:05 UTC
    expect(titles(await runSender('2030-03-20T15:00:00Z', '2030-03-20T15:15:00Z'), ana.id)).toEqual([
      'Ana, Dentist is today at 17:35 🔔',
    ])

    // back to 15:00: that moment already went out, so nothing goes out twice
    await set({ due_time: '15:00' })
    expect(titles(await runSender('2030-03-20T12:15:00Z', '2030-03-20T12:30:00Z'), ana.id)).toEqual([])
  })

  it('editing only the name, notes, price or category never sends a second push', async () => {
    const { ana, items } = await personWith([dentist])
    const window = ['2030-03-20T12:15:00Z', '2030-03-20T12:30:00Z'] as const
    expect(titles(await runSender(...window), ana.id)).toHaveLength(1)
    await ana.client
      .from('items')
      .update({ name: 'Dentist (Dr Tamm)', notes: 'bring card', price_cents: 4000, category: 'health' })
      .eq('id', items[0]!.id)
    expect(titles(await runSender(...window), ana.id)).toEqual([])
  })

  it('moving the Event date sends its Reminders again for the new date', async () => {
    const { ana, items } = await personWith([{ ...base, name: 'Car service', due_date: '2030-03-20' }])
    // all day: "1 day" goes out the day before at 12:00 local
    expect(titles(await runSender('2030-03-19T09:45:00Z', '2030-03-19T10:00:00Z'), ana.id)).toEqual([
      'Ana, Car service is tomorrow 🔔',
    ])
    await ana.client.from('items').update({ due_date: '2030-03-25' }).eq('id', items[0]!.id)
    expect(titles(await runSender('2030-03-24T09:45:00Z', '2030-03-24T10:00:00Z'), ana.id)).toEqual([
      'Ana, Car service is tomorrow 🔔',
    ])
  })

  it('gives each push its own notification tag: Event, date, kind and moment', async () => {
    const { ana, items } = await personWith([dentist])
    const [first] = forAna(await runSender('2030-03-20T12:15:00Z', '2030-03-20T12:30:00Z'), ana.id)
    await ana.client.from('items').update({ due_time: '17:35' }).eq('id', items[0]!.id)
    const [second] = forAna(await runSender('2030-03-20T15:00:00Z', '2030-03-20T15:15:00Z'), ana.id)
    const tag = (s: Sent) => s.messages[0]!.tag
    expect(tag(first!)).toContain(items[0]!.id)
    expect(tag(first!)).toContain('2030-03-20')
    expect(tag(first!)).toContain('30m')
    expect(tag(second!)).not.toBe(tag(first!))
  })
})
