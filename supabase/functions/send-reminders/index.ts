// Reminder sender. Supabase Cron calls it every 15 minutes. It works out, with the shared rules,
// which Reminders fell due since the last run that worked, claims each one so it goes out only once,
// bundles them per person and sends one push to each of that person's devices.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import * as webpush from 'npm:web-push@4.0.0'
import {
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
async function all<T extends Row>(table: string, columns: string, onlyActive = false): Promise<T[]> {
  const rows: T[] = []
  for (let start = 0; ; start += PAGE) {
    let query = db
      .from(table)
      .select(columns)
      .order('id')
      .range(start, start + PAGE - 1)
    if (onlyActive) query = query.is('archived_at', null)
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
      'id, user_id, name, category, due_date, due_time, recurrence_unit, recurrence_every, reminder_offsets, handled_due_date, created_at',
      true,
    ),
    all<Device & Row>('push_devices', 'id, user_id, endpoint, p256dh, auth'),
  ])
  const itemsOf = groupByUser(items)
  const devicesOf = groupByUser(devices)

  const report: unknown[] = []
  let anyFailed = false

  for (const p of people) {
    const mine = itemsOf.get(p.id)
    if (!mine?.length) continue
    // one person's problem never stops everyone else's Reminders
    try {
      const person: SenderPerson = {
        id: p.id,
        name: p.name,
        timeZone: usableTimeZone(p.time_zone),
        dayReminderTime: p.day_reminder_time.slice(0, 5),
      }
      const byId = new Map(mine.map((i) => [i.id as string, i]))
      const senderItems: SenderItem[] = mine.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        dueDate: i.due_date,
        dueTime: i.due_time?.slice(0, 5) ?? null,
        recurrence: i.recurrence_unit ? { unit: i.recurrence_unit, every: i.recurrence_every } : null,
        reminderOffsets: i.reminder_offsets,
        handledDueDate: i.handled_due_date,
        createdAt: new Date(i.created_at),
      }))
      const due = dueReminders(person, senderItems, from, to)
      if (!due.length) continue

      // Claim before sending: a Reminder another run already claimed is skipped here.
      const rows = due.map((d) => ({ item_id: d.itemId, due_date: d.dueDate, kind: d.kind }))
      const { data: claimed, error } = await db
        .from('sent_reminders')
        .upsert(rows, { onConflict: 'item_id,due_date,kind', ignoreDuplicates: true })
        .select('item_id, due_date, kind')
      if (error) throw error
      if (!claimed?.length) continue

      const entries: MessageEntry[] = claimed.map((c) => {
        const i = byId.get(c.item_id)!
        return {
          item: { id: i.id, name: i.name, category: i.category, dueTime: i.due_time?.slice(0, 5) ?? null },
          dueDate: c.due_date,
          kind: c.kind,
        }
      })
      const message = pushMessage(person, entries, todayIn(person.timeZone, to))
      const targets = devicesOf.get(p.id) ?? []
      const outcomes = await Promise.all(targets.map((d) => send(d, JSON.stringify(message))))
      const gone = targets.filter((_, n) => outcomes[n] === 'gone').map((d) => d.id)
      if (gone.length) await db.from('push_devices').delete().in('id', gone)

      // Nothing reached any device and something may work next time: release the claims, so the
      // next run (which looks back to the last full success) sends them again.
      if (outcomes.includes('failed') && !outcomes.includes('delivered')) {
        for (const c of claimed) {
          await db.from('sent_reminders').delete().match({ item_id: c.item_id, due_date: c.due_date, kind: c.kind })
        }
        anyFailed = true
      }
      report.push({
        userId: p.id,
        message,
        entries: claimed,
        delivered: targets.filter((_, n) => outcomes[n] === 'delivered').map((d) => d.endpoint),
      })
    } catch (e) {
      console.error(`Reminders for ${p.id} failed`, e)
      anyFailed = true
    }
  }

  // The next run starts where this one ended, unless something failed and needs another try.
  if (!anyFailed && !(testing && input.from)) {
    await db.from('reminder_runs').upsert({ id: 1, last_run_at: to.toISOString() })
  }
  return Response.json({ from, to, sent: report, failed: anyFailed })
})
