import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { query } from './db.ts'
import { signUpPerson } from './people.ts'

const local = JSON.parse(
  execSync('pnpm exec supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(),
)

interface Step {
  id: string
  step: string
  done: boolean
}
async function cleanUp(): Promise<Step[]> {
  const res = await fetch(`${local.API_URL}/functions/v1/account-cleanup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${local.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!res.ok) throw new Error(`clean-up answered ${res.status}`)
  return (await res.json()).report
}
/** Makes only this person look idle, so other tests' people are never touched. */
const age = (id: string, sets: string) => query(`update public.profiles set ${sets} where id = '${id}'`)
const mine = (steps: Step[], id: string) => steps.filter((s) => s.id === id).map((s) => s.step)

describe('unused accounts', () => {
  it('warns 30 days before, then 7 days before, then deletes', async () => {
    const ana = await signUpPerson('Ana')
    await age(ana.id, `last_active_at = now() - interval '335 days'`)
    expect(mine(await cleanUp(), ana.id)).toEqual(['warn30'])
    expect(mine(await cleanUp(), ana.id)).toEqual([])

    await age(ana.id, `last_active_at = now() - interval '358 days', warned_30_at = now() - interval '23 days'`)
    expect(mine(await cleanUp(), ana.id)).toEqual(['warn7'])

    await age(ana.id, `last_active_at = now() - interval '365 days', warned_7_at = now() - interval '7 days'`)
    expect(mine(await cleanUp(), ana.id)).toEqual(['delete'])
    expect(await query(`select 1 from public.profiles where id = '${ana.id}'`)).toEqual([])
    expect(await query(`select 1 from public.deleted_accounts where user_id = '${ana.id}'`)).toHaveLength(1)
  })

  it('using the app starts the clock over and clears warnings', async () => {
    const ana = await signUpPerson('Ana')
    await age(ana.id, `last_active_at = now() - interval '360 days', warned_30_at = now() - interval '25 days'`)
    expect((await ana.client.rpc('touch_activity')).error).toBeNull()
    const [row] = await query<{ idle: number; warned: string | null }>(
      `select extract(day from now() - last_active_at)::int as idle, warned_30_at as warned from public.profiles where id = '${ana.id}'`,
    )
    expect(row).toEqual({ idle: 0, warned: null })
    expect(mine(await cleanUp(), ana.id)).toEqual([])
  })
})

describe('unused accounts, edge cases', () => {
  it('never emails an address that was never confirmed; such an account just goes after a year', async () => {
    const ghost = await signUpPerson('Ghost')
    await query(`update auth.users set email_confirmed_at = null where id = '${ghost.id}'`)
    await age(ghost.id, `last_active_at = now() - interval '340 days'`)
    expect(mine(await cleanUp(), ghost.id)).toEqual([])
    await age(ghost.id, `last_active_at = now() - interval '366 days'`)
    expect(mine(await cleanUp(), ghost.id)).toEqual(['delete'])
    expect(await query(`select 1 from public.profiles where id = '${ghost.id}'`)).toEqual([])
  })

  it('a calendar app reading the feed counts as use', async () => {
    const ana = await signUpPerson('Ana')
    const { data: token } = await ana.client.rpc('new_calendar_link')
    await age(ana.id, `last_active_at = now() - interval '340 days', warned_30_at = now() - interval '5 days'`)
    await fetch(`${local.API_URL}/functions/v1/calendar-feed?token=${token}`)
    const [row] = await query<{ idle: number; warned: string | null }>(
      `select extract(day from now() - last_active_at)::int as idle, warned_30_at as warned from public.profiles where id = '${ana.id}'`,
    )
    expect(row).toEqual({ idle: 0, warned: null })
  })
})
