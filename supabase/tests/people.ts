import { execSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Keys of the running local Supabase stack (`pnpm db:start`), read at test time so none live in the repo.
const local = JSON.parse(
  execSync('pnpm exec supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(),
)
const LOCAL_API_URL: string = local.API_URL
const LOCAL_PUBLISHABLE_KEY: string = local.PUBLISHABLE_KEY
const LOCAL_SECRET_KEY: string = local.SECRET_KEY

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }
export const anonymous = () => createClient(LOCAL_API_URL, LOCAL_PUBLISHABLE_KEY, noSession)
const admin = createClient(LOCAL_API_URL, LOCAL_SECRET_KEY, noSession)

export interface Person {
  id: string
  email: string
  client: SupabaseClient
}

/** A fake person with a confirmed account, logged in on their own client. */
export async function signUpPerson(name: string, surname = 'Tester', extra: object = {}): Promise<Person> {
  const email = `${name.toLowerCase()}.${crypto.randomUUID()}@example.test`
  const password = 'correct-horse-battery'
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, surname, confirmed_16_plus: true, ...extra },
  })
  if (error) throw error
  const client = anonymous()
  const login = await client.auth.signInWithPassword({ email, password })
  if (login.error) throw login.error
  return { id: data.user.id, email, client }
}

/**
 * A fake person who signed up with Google: made straight in the auth table the way Google signups
 * arrive (provider "google", Google's own details, no 16+ confirmation yet). A password is set only
 * so the test can log in as them.
 */
export async function signUpWithGoogle(googleDetails: object): Promise<Person> {
  const { query } = await import('./db.ts')
  const email = `google.${crypto.randomUUID()}@example.test`
  const password = 'correct-horse-battery'
  const [made] = await query<{ id: string }>(
    `
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
      $1, extensions.crypt($2, extensions.gen_salt('bf')), now(),
      '{"provider": "google", "providers": ["google"]}', $3, now(), now(), '', '', '', ''
    ) returning id`,
    [email, password, JSON.stringify({ ...googleDetails, email })],
  )
  const id = made!.id
  const client = anonymous()
  const login = await client.auth.signInWithPassword({ email, password })
  if (login.error) throw login.error
  return { id, email, client }
}
