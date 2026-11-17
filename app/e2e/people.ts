import { execSync } from 'node:child_process'
import { expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const local = JSON.parse(
  execSync('pnpm exec supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(),
)
const admin = createClient(local.API_URL, local.SECRET_KEY, { auth: { persistSession: false } })

/** Creates a confirmed account directly and logs in through the app, skipping the signup screens. */
export async function logInAsNewPerson(page: Page, name = 'Ana', surname = 'García López') {
  const email = `${name.toLowerCase()}.${crypto.randomUUID()}@example.test`
  const password = 'correct-horse-battery'
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, surname, confirmed_16_plus: true },
  })
  if (error) throw error
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText(`Welcome, ${name}`)).toBeVisible()
}

/** A date `days` from today as YYYY-MM-DD, in the browser's time zone. */
export function inDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA')
}
