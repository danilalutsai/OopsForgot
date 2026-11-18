import { execSync } from 'node:child_process'
import { expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const local = JSON.parse(
  execSync('pnpm exec supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(),
)
const admin = createClient(local.API_URL, local.SECRET_KEY, { auth: { persistSession: false } })

/** Creates a confirmed account directly and logs in through the app, skipping the signup screens. */
export async function logInAsNewPerson(
  page: Page,
  name = 'Ana',
  surname = 'García López',
  // the browser's own zone by default, so no "Update time zone?" question appears
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  const email = `${name.toLowerCase()}.${crypto.randomUUID()}@example.test`
  const password = 'correct-horse-battery'
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, surname, confirmed_16_plus: true, time_zone: timeZone, currency: 'EUR' },
  })
  if (error) throw error
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText(`Welcome, ${name}`)).toBeVisible()
  return { email, password }
}

/** A date `days` from today as YYYY-MM-DD, worked out in the browser so it matches the app's idea of today. */
export function inDays(page: Page, days: number): Promise<string> {
  return page.evaluate((n) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d.toLocaleDateString('en-CA')
  }, days)
}

/**
 * Creates an account the way a Google signup arrives (provider "google", Google's details, no 16+
 * confirmation yet) and logs in. The real Google page can't run in tests, so the account has a
 * password just long enough to log in, then only a Google identity.
 */
export async function logInAsNewGooglePerson(page: Page, googleDetails: object = { full_name: 'Ben Ortiz' }) {
  const email = `google.${crypto.randomUUID()}@example.test`
  const password = 'correct-horse-battery'
  const db = new pg.Client(local.DB_URL)
  await db.connect()
  try {
    await db.query(
      `insert into auth.users (
         instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
         raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
         confirmation_token, recovery_token, email_change_token_new, email_change
       ) values (
         '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
         $1, extensions.crypt($2, extensions.gen_salt('bf')), now(),
         '{"provider": "google", "providers": ["google"]}', $3, now(), now(), '', '', '', ''
       )`,
      [email, password, JSON.stringify({ ...googleDetails, email })],
    )
  } finally {
    await db.end()
  }
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/welcome/)
  // logged in now: make the account truly Google-only (a Google identity, no password)
  const after = new pg.Client(local.DB_URL)
  await after.connect()
  try {
    await after.query(
      `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
       select 'google-' || id, id, jsonb_build_object('sub', 'google-' || id, 'email', email), 'google', now(), now(), now()
         from auth.users where email = $1`,
      [email],
    )
    await after.query(`update auth.users set encrypted_password = '' where email = $1`, [email])
  } finally {
    await after.end()
  }
  // the app reads the account's ways in again
  await page.reload()
  return { email, password }
}
