// Daily clean-up of unused accounts: a warning 30 days and 7 days before, then deletion after
// 12 months without use. An account is never deleted unless both warnings really went out.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { unusedAccountStep } from '../../../shared/src/index.ts'
import { deleteAccount } from '../_shared/deleteAccount.ts'
import { sendMail } from '../_shared/mail.ts'

const env = (name: string) => Deno.env.get(name) ?? ''
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
const testing = env('REMINDERS_TEST_MODE') === '1'
const APP_URL = env('APP_URL') || 'https://oopsproof.pages.dev'
const admin = createClient(env('SUPABASE_URL'), SERVICE_KEY, { auth: { persistSession: false } })

function warning(name: string, days: 30 | 7) {
  return {
    subject:
      days === 30
        ? 'Your OopsProof account will be deleted in 30 days'
        : 'Your OopsProof account will be deleted in 7 days',
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

Deno.serve(async (req) => {
  if (req.headers.get('Authorization') !== `Bearer ${SERVICE_KEY}`) return new Response('Forbidden', { status: 403 })
  const input = await req.json().catch(() => ({}))
  const now = testing && input.now ? new Date(input.now) : new Date()

  const report: { id: string; step: string; done: boolean; to?: string }[] = []
  for (let start = 0; ; start += 1000) {
    const { data: people, error } = await admin
      .from('profiles')
      .select('id, name, last_active_at, warned_30_at, warned_7_at')
      .order('id')
      .range(start, start + 999)
    if (error) throw error

    for (const p of people) {
      const step = unusedAccountStep(
        {
          lastActive: new Date(p.last_active_at),
          warned30At: p.warned_30_at ? new Date(p.warned_30_at) : null,
          warned7At: p.warned_7_at ? new Date(p.warned_7_at) : null,
        },
        now,
      )
      if (!step) continue
      try {
        if (step === 'delete') {
          report.push({ id: p.id, step, done: await deleteAccount(admin, p.id) })
          continue
        }
        const { data: user } = await admin.auth.admin.getUserById(p.id)
        const to = user.user?.email
        if (!to) continue
        const days = step === 'warn30' ? 30 : 7
        const sent = testing ? true : await sendMail({ to, ...warning(p.name, days) })
        // only a warning that really went out counts, so deletion never comes unannounced
        if (sent) {
          const column = step === 'warn30' ? 'warned_30_at' : 'warned_7_at'
          await admin
            .from('profiles')
            .update({ [column]: now.toISOString() })
            .eq('id', p.id)
        }
        report.push({ id: p.id, step, done: sent, to })
      } catch (e) {
        console.error(`Clean-up step ${step} for ${p.id} failed`, e)
      }
    }
    if (people.length < 1000) break
  }
  return Response.json({ now, report })
})
