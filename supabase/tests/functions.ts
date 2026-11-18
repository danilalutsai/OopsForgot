import { execSync } from 'node:child_process'
import type { Person } from './people.ts'

const local = JSON.parse(
  execSync('pnpm exec supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(),
)

/** Calls one of the served Edge Functions as the person (`pnpm functions:serve`). */
export async function callFunction(name: string, person: Person, body: object = {}) {
  const token = (await person.client.auth.getSession()).data.session!.access_token
  return fetch(`${local.API_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: local.PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Makes the person's sign-in look an hour old (a renewed token keeps that time). */
export async function signedInLongAgo(person: Person) {
  const { query } = await import('./db.ts')
  await query(
    `update auth.mfa_amr_claims set created_at = now() - interval '1 hour', updated_at = now() - interval '1 hour'
      where session_id in (select id from auth.sessions where user_id = $1)`,
    [person.id],
  )
  await person.client.auth.refreshSession()
}
