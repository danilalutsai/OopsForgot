// Reminder sender. Supabase Cron calls it every 15 minutes. It works out, with the shared rules,
// which Reminders fell due since the last run that worked, claims each one so it goes out only once,
// bundles them per person and sends one push to each of that person's devices.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import * as webpush from 'npm:web-push@4.0.0'
import {
  automaticExpenseDates,
  dueReminders,
  type MessageEntry,
  pushMessage,
  type SenderItem,
  type SenderPerson,
  todayIn,
} from '../../../shared/src/index.ts'

const env = (name: string) => Deno.env.get(name) ?? ''
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
// Local test switches: a fake clock and a fake push service that only reports what it would send.
const testing = env('REMINDERS_TEST_MODE') === '1'
/** A run never looks further back than this, even after a long outage. */
const MAX_CATCH_UP_MS = 24 * 60 * 60 * 1000
const PAGE = 1000

const db = createClient(env('SUPABASE_URL'), SERVICE_KEY, { auth: { persistSession: false } })

if (!testing) webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))

interface Device {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>

/** Every row of a table, page by page (the API returns at most 1000 at a time). */
async function all<T extends Row>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = []
  for (let start = 0; ; start += PAGE) {
    const query = db
      .from(table)
      .select(columns)
      .order('id')
      .range(start, start + PAGE - 1)
    const { data, error } = await query
    if (error) throw error
    rows.push(...(data as unknown as T[]))
    if (data.length < PAGE) return rows
  }
}

function groupByUser<T extends Row>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const list = map.get(r.user_id)
    if (list) list.push(r)
    else map.set(r.user_id, [r])
  }
  return map
}

/** A time zone the runtime can work with; anything else counts as UTC rather than stopping the run. */
function usableTimeZone(zone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return zone
  } catch {
    return 'UTC'
  }
}

type Outcome = 'delivered' | 'gone' | 'failed'

async function send(device: Device, payload: string): Promise<Outcome> {
  if (testing) return 'delivered'
  try {
    await webpush.sendNotification(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      payload,
      { TTL: 60 * 60 * 24, urgency: 'high' },
    )
    return 'delivered'
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode
    // 404/410: the subscription is gone for good; anything else may work next time
    return status === 404 || status === 410 ? 'gone' : 'failed'
  }
}

/**
 * Priced Items create an Expense on each Due date (up to today, never before they were added).
 * Every Item's expenses_through moves on to today, priced or not, archived or not, so a deleted
 * automatic Expense never comes back, and adding a price later or restoring an archived Item never
 * fills in past Due dates.
 */
async function createAutomaticExpenses(
  person: SenderPerson,
  items: Row[],
  senderItems: Map<string, SenderItem>,
  now: Date,
) {
  const today = todayIn(person.timeZone, now)
  const rows: Row[] = []
  const moved: string[] = []
  for (const i of items) {
    if (i.expenses_through === today) continue
    moved.push(i.id)
    const s = senderItems.get(i.id)
    if (!s || i.archived_at) continue
    for (const date of automaticExpenseDates(
      {
        dueDate: s.dueDate,
        recurrence: s.recurrence,
        priceCents: i.price_cents,
        category: s.category,
        addedOn: todayIn(person.timeZone, s.createdAt),
      },
      i.expenses_through,
      today,
    )) {
      rows.push({
        user_id: person.id,
        amount_cents: i.price_cents,
        category: s.category,
        date,
        item_id: i.id,
        item_name: s.name,
      })
    }
  }
  if (rows.length) {
    const { error } = await db.from('expenses').upsert(rows, { onConflict: 'item_id,date', ignoreDuplicates: true })
    if (error) throw error
  }
  if (moved.length) {
    const { error } = await db.from('items').update({ expenses_through: today }).in('id', moved)
    if (error) throw error
  }
}

/** Claims, bundles and sends one person's due Reminders. Returns what was sent, or null for nothing. */
async function remind(person: SenderPerson, items: SenderItem[], targets: Device[], from: Date, to: Date) {
  const due = dueReminders(person, items, from, to)
  if (!due.length) return null

  // Claim before sending: a Reminder another run already claimed is skipped here.
  const rows = due.map((d) => ({ item_id: d.itemId, due_date: d.dueDate, kind: d.kind }))
  const { data: claimed, error } = await db
    .from('sent_reminders')
    .upsert(rows, { onConflict: 'item_id,due_date,kind', ignoreDuplicates: true })
    .select('item_id, due_date, kind')
  if (error) throw error
  if (!claimed?.length) return null

  const byId = new Map(items.map((i) => [i.id, i]))
  const entries: MessageEntry[] = claimed.map((c) => {
    const i = byId.get(c.item_id)!
    return {
      item: { id: i.id, name: i.name, category: i.category, dueTime: i.dueTime },
      dueDate: c.due_date,
      kind: c.kind,
    }
  })
  const message = pushMessage(person, entries, todayIn(person.timeZone, to))
  const outcomes = await Promise.all(targets.map((d) => send(d, JSON.stringify(message))))
  const gone = targets.filter((_, n) => outcomes[n] === 'gone').map((d) => d.id)
  if (gone.length) await db.from('push_devices').delete().in('id', gone)

  // Nothing reached any device and something may work next time: release the claims, so the
  // next run (which looks back to the last full success) sends them again.
  const failed = outcomes.includes('failed') && !outcomes.includes('delivered')
  if (failed) {
    for (const c of claimed) {
      await db.from('sent_reminders').delete().match({ item_id: c.item_id, due_date: c.due_date, kind: c.kind })
    }
  }
  return {
    userId: person.id,
    message,
    entries: claimed,
    delivered: targets.filter((_, n) => outcomes[n] === 'delivered').map((d) => d.endpoint),
    failed,
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('Authorization') !== `Bearer ${SERVICE_KEY}`) return new Response('Forbidden', { status: 403 })
  const input = await req.json().catch(() => ({}))

  const to = testing && input.now ? new Date(input.now) : new Date()
  const { data: run } = await db.from('reminder_runs').select('last_run_at').maybeSingle()
  const earliest = new Date(to.getTime() - MAX_CATCH_UP_MS)
  const last = testing && input.from ? new Date(input.from) : run ? new Date(run.last_run_at) : null
  const from = last ? (last > earliest ? last : earliest) : new Date(to.getTime() - 15 * 60_000)

  const [people, items, devices] = await Promise.all([
    all<Row>('profiles', 'id, name, time_zone, day_reminder_time'),
    all<Row>(
      'items',
      'id, user_id, name, category, due_date, due_time, recurrence_unit, recurrence_every, reminder_offsets, handled_due_date, created_at, price_cents, expenses_through, archived_at',
    ),
    all<Device & Row>('push_devices', 'id, user_id, endpoint, p256dh, auth'),
  ])
  const itemsOf = groupByUser(items)
  const devicesOf = groupByUser(devices)

  const report: unknown[] = []
  let anyFailed = false

  for (const p of people) {
    const owned = itemsOf.get(p.id)
    if (!owned?.length) continue
    const person: SenderPerson = {
      id: p.id,
      name: p.name,
      timeZone: usableTimeZone(p.time_zone),
      dayReminderTime: p.day_reminder_time.slice(0, 5),
    }
    const senderItems = new Map<string, SenderItem>(
      owned.map((i) => [
        i.id,
        {
          id: i.id,
          name: i.name,
          category: i.category,
          dueDate: i.due_date,
          dueTime: i.due_time?.slice(0, 5) ?? null,
          recurrence: i.recurrence_unit ? { unit: i.recurrence_unit, every: i.recurrence_every } : null,
          reminderOffsets: i.reminder_offsets,
          handledDueDate: i.handled_due_date,
          createdAt: new Date(i.created_at),
        },
      ]),
    )
    const active = owned.filter((i) => !i.archived_at).map((i) => senderItems.get(i.id)!)

    // Reminders first; one person's problem never stops everyone else's
    try {
      const sent = await remind(person, active, devicesOf.get(p.id) ?? [], from, to)
      if (sent) {
        report.push(sent)
        if (sent.failed) anyFailed = true
      }
    } catch (e) {
      console.error(`Reminders for ${p.id} failed`, e)
      anyFailed = true
    }

    // Expenses are an extra: a problem here is logged and never holds up Reminders
    try {
      await createAutomaticExpenses(person, owned, senderItems, to)
    } catch (e) {
      console.error(`Automatic Expenses for ${p.id} failed`, e)
    }
  }

  // The next run starts where this one ended, unless something failed and needs another try.
  if (!anyFailed && !(testing && input.from)) {
    await db.from('reminder_runs').upsert({ id: 1, last_run_at: to.toISOString() })
  }
  return Response.json({ from, to, sent: report, failed: anyFailed })
})
