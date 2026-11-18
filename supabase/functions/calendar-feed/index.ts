// Calendar feed: calendar apps fetch it with the secret token in the link. No login, no other key.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { calendarFeed, type FeedItem, todayIn, usableTimeZone } from '../../../shared/src/index.ts'

const env = (name: string) => Deno.env.get(name) ?? ''
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
const APP_URL = env('APP_URL') || 'https://oopsproof.pages.dev'

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token') ?? ''
  // tokens are 48 hex characters; anything else is not worth a database call
  if (!/^[0-9a-f]{48}$/.test(token)) return new Response('Not found', { status: 404 })

  const { data: person, error: lookup } = await db
    .from('profiles')
    .select('id, time_zone')
    .eq('calendar_token', token)
    .maybeSingle()
  // a database hiccup must not look like a dead link: calendar apps may drop a subscription on 404
  if (lookup) return new Response('Try again later', { status: 503 })
  if (!person) return new Response('Not found', { status: 404 })

  const { data: items, error } = await db
    .from('items')
    .select('id, name, category, due_date, due_time, recurrence_unit, recurrence_every, handled_due_date')
    .eq('user_id', person.id)
    .is('archived_at', null)
  if (error) return new Response('Try again later', { status: 503 })

  const timeZone = usableTimeZone(person.time_zone)
  // a calendar app reading the feed means the person still relies on OopsProof: that counts as
  // use for unused-account clean-up (written at most once a day)
  await db
    .from('profiles')
    .update({ last_active_at: new Date().toISOString(), warned_30_at: null, warned_7_at: null })
    .eq('id', person.id)
    .lt('last_active_at', new Date(Date.now() - 86_400_000).toISOString())
  const now = new Date()
  const feedItems: FeedItem[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    dueDate: i.due_date,
    dueTime: i.due_time?.slice(0, 5) ?? null,
    recurrence: i.recurrence_unit ? { unit: i.recurrence_unit, every: i.recurrence_every } : null,
    handledDueDate: i.handled_due_date,
  }))
  const body = calendarFeed(feedItems, { today: todayIn(timeZone, now), timeZone, appUrl: APP_URL, now })
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="oopsproof.ics"',
      // never kept anywhere: a reset or turned-off link stops showing anything at once
      'Cache-Control': 'no-store',
    },
  })
})
