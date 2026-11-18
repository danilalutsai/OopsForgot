// Daily clean-up of unused accounts: a warning 30 days and 7 days before, then deletion after
// 12 months without use. An account is never deleted unless both warnings really went out, and
// never if it was used since this run read it.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { unusedAccountStep, type UsageState } from '../../../shared/src/index.ts'
import { deleteAccount } from '../_shared/deleteAccount.ts'
import { sendMail } from '../_shared/mail.ts'
import { allRows, type Row } from '../_shared/rows.ts'

const env = (name: string) => Deno.env.get(name) ?? ''
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
const testing = env('REMINDERS_TEST_MODE') === '1'
const APP_URL = env('APP_URL') || 'https://oopsproof.pages.dev'
const admin = createClient(env('SUPABASE_URL'), SERVICE_KEY, { auth: { persistSession: false } })
const COLUMNS = 'id, name, last_active_at, warned_30_at, warned_7_at'

const usage = (p: Row): UsageState => ({
  lastActive: new Date(p.last_active_at),
  warned30At: p.warned_30_at ? new Date(p.warned_30_at) : null,
  warned7At: p.warned_7_at ? new Date(p.warned_7_at) : null,
})

function warning(name: string, days: 30 | 7) {
  return {
    subject: `Your OopsProof account will be deleted in ${days} days`,
    text: [
      `Hi ${name},`,
      '',
      `You haven't used OopsProof for almost a year, so your account and everything in it will be deleted in ${days} days.`,
      '',
      `Keep my account: ${APP_URL}/?keep=1`,
      '',
      'Just open the link (or the app) and log in; nothing else is needed. If you no longer need OopsProof, do nothing.',
    ].join('\n'),
  }
}

type Report = { id: string; step: string; done: boolean }

const YEAR_MS = 365 * 86_400_000

/** Deletes only if the account is, read again just now, still due for deletion. */
async function deleteIfStillIdle(id: string, now: Date, confirmed: boolean): Promise<Report> {
  const { data: fresh } = await admin.from('profiles').select(COLUMNS).eq('id', id).maybeSingle()
  const stillIdle = fresh
    ? confirmed
      ? unusedAccountStep(usage(fresh), now) === 'delete'
      : now.getTime() - new Date(fresh.last_active_at).getTime() >= YEAR_MS
    : false
  if (!stillIdle) return { id, step: 'kept', done: true }
  return { id, step: 'delete', done: (await deleteAccount(admin, id)) === 'deleted' }
}

async function handle(p: Row, now: Date): Promise<Report | null> {
  const step = unusedAccountStep(usage(p), now)
  if (!step) return null

  const { data: user, error: lookup } = await admin.auth.admin.getUserById(p.id)
  if (lookup) throw lookup
  const email = user.user?.email_confirmed_at ? user.user.email : null

  // An address never confirmed belongs to nobody we can warn (and the account can't even log in):
  // no emails to a stranger; the account is simply removed once a year has passed.
  if (!email) {
    return now.getTime() - usage(p).lastActive.getTime() >= YEAR_MS ? deleteIfStillIdle(p.id, now, false) : null
  }
  if (step === 'delete') return deleteIfStillIdle(p.id, now, true)

  const days = step === 'warn30' ? 30 : 7
  const sent = testing ? true : await sendMail({ to: email, ...warning(p.name, days) })
  // only a warning that really went out counts, so deletion never comes unannounced
  if (sent) {
    const column = step === 'warn30' ? 'warned_30_at' : 'warned_7_at'
    await admin
      .from('profiles')
      .update({ [column]: now.toISOString() })
      .eq('id', p.id)
  }
  return { id: p.id, step, done: sent }
}

Deno.serve(async (req) => {
  if (req.headers.get('Authorization') !== `Bearer ${SERVICE_KEY}`) return new Response('Forbidden', { status: 403 })
  const input = await req.json().catch(() => ({}))
  const now = testing && input.now ? new Date(input.now) : new Date()

  // everyone first, then the changes, so deleting someone never makes the run skip someone else
  const people = (await allRows(admin, 'profiles', COLUMNS)).filter((p) => unusedAccountStep(usage(p), now))
  const report: Report[] = []
  // a few at a time: fast enough for a busy day, gentle on Gmail
  for (let i = 0; i < people.length; i += 5) {
    const batch = await Promise.allSettled(people.slice(i, i + 5).map((p) => handle(p, now)))
    batch.forEach((r, n) => {
      if (r.status === 'fulfilled' && r.value) report.push(r.value)
      if (r.status === 'rejected') console.error(`Clean-up for ${people[i + n]!.id} failed`, r.reason)
    })
  }
  return Response.json({ now, report })
})
