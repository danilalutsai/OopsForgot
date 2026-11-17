// Reminder sender. Supabase Cron calls it every 15 minutes. It works out, with the shared rules,
// which Reminders fell due since the last run that worked, claims each one so it goes out only once,
// bundles them per person and sends one push to each of that person's devices.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import * as webpush from 'npm:web-push@4.0.0'
import {
  type DueReminder,
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

const db = createClient(env('SUPABASE_URL'), SERVICE_KEY, { auth: { persistSession: false } })

if (!testing) webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))

interface Device {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

/** Sends one push; false when the subscription is gone for good (the device is then forgotten). */
async function send(device: Device, payload: string): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      payload,
      { TTL: 60 * 60 * 24, urgency: 'high' },
    )
    return true
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) return false
    throw e
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('Authorization') !== `Bearer ${SERVICE_KEY}`) return new Response('Forbidden', { status: 403 })
  const input = await req.json().catch(() => ({}))

  const to = testing && input.now ? new Date(input.now) : new Date()
  const { data: run } = await db.from('reminder_runs').select('last_run_at').maybeSingle()
  const from =
    testing && input.from
      ? new Date(input.from)
      : run
        ? new Date(run.last_run_at)
        : new Date(to.getTime() - 15 * 60_000)

  const [people, items, devices] = await Promise.all([
    db.from('profiles').select('id, name, time_zone, day_reminder_time'),
    db
      .from('items')
      .select(
        'id, user_id, name, category, due_date, due_time, recurrence_unit, recurrence_every, reminder_offsets, handled_due_date, created_at',
      )
      .is('archived_at', null),
    db.from('push_devices').select('id, user_id, endpoint, p256dh, auth'),
  ])
  for (const r of [people, items, devices]) if (r.error) throw r.error

  const report: unknown[] = []
  for (const p of people.data!) {
    const person: SenderPerson = {
      id: p.id,
      name: p.name,
      timeZone: p.time_zone,
      dayReminderTime: p.day_reminder_time.slice(0, 5),
    }
    const mine = items.data!.filter((i) => i.user_id === p.id)
    const byId = new Map(mine.map((i) => [i.id, i]))
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
    const { data: claimed, error } = await db
      .from('sent_reminders')
      .upsert(
        due.map((d: DueReminder) => ({ item_id: d.itemId, due_date: d.dueDate, kind: d.kind })),
        { onConflict: 'item_id,due_date,kind', ignoreDuplicates: true },
      )
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
    const targets = devices.data!.filter((d) => d.user_id === p.id)
    const delivered: string[] = []
    for (const device of targets) {
      if (testing) {
        delivered.push(device.endpoint)
        continue
      }
      if (await send(device, JSON.stringify(message))) delivered.push(device.endpoint)
      else await db.from('push_devices').delete().eq('id', device.id)
    }
    report.push({ userId: p.id, message, entries: claimed, delivered })
  }

  // The next run starts where this one ended.
  if (!testing || !input.from) await db.from('reminder_runs').upsert({ id: 1, last_run_at: to.toISOString() })
  return Response.json({ from, to, sent: report })
})
