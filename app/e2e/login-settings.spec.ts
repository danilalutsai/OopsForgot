import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './axe'
import { clearInbox, linkFromEmail } from './inbox'
import { connectFakeGoogle, logInAsNewGooglePerson, logInAsNewPerson } from './people'

async function openSettings(page: Page) {
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
}

test('change the password: the current one is checked first', async ({ page }) => {
  const person = await logInAsNewPerson(page)
  await openSettings(page)
  await page.getByRole('button', { name: /^Password/ }).click()
  await expectAccessible(page)
  await page.getByLabel('Current password').fill('not-my-password')
  await page.getByLabel('New password').fill('a-brand-new-password')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.getByRole('alert')).toHaveText('That password isn’t right.')

  await page.getByLabel('Current password').fill(person.password)
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.getByText('Password saved ✅')).toBeVisible()

  await page.goto('/')
  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await page.getByLabel('Email').fill(person.email)
  await page.getByLabel('Password').fill('a-brand-new-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('Welcome, Ana')).toBeVisible()
})

test('change the email: the old one works until both links are opened', async ({ page }) => {
  const person = await logInAsNewPerson(page)
  const newEmail = `ana.new.${crypto.randomUUID()}@example.test`
  await clearInbox(person.email)
  await openSettings(page)
  await page.getByRole('button', { name: /^Email/ }).click()
  await page.getByLabel('New email').fill(newEmail)
  await page.getByRole('button', { name: 'Send confirmation links' }).click()
  await expect(page.getByText(`Waiting for ${newEmail}`)).toBeVisible()
  await expect(page.getByRole('button', { name: /^Email/ })).toContainText(person.email)

  await page.goto(await linkFromEmail(person.email))
  await page.goto(await linkFromEmail(newEmail))
  await page.goto('/settings')
  await expect(page.getByRole('button', { name: /^Email/ })).toContainText(newEmail)
})

test('a Google-only person adds a password; Google stays their way in', async ({ page }) => {
  await logInAsNewGooglePerson(page)
  await page.getByLabel('I am 16 or older').check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await openSettings(page)
  await expect(page.getByRole('button', { name: /^Password/ })).toContainText('Not set')
  await page.getByRole('button', { name: /^Password/ }).click()
  await expect(page.getByLabel('Current password')).toHaveCount(0)
  await page.getByLabel('New password').fill('a-brand-new-password')
  await page.getByRole('button', { name: 'Add password' }).click()
  await expect(page.getByText('Password saved ✅')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Password/ })).toContainText('Set')

  await page.getByRole('button', { name: /^Google/ }).click()
  await expect(page.getByText(/Your account was made with Google/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Disconnect Google' })).toHaveCount(0)
})

test('someone with a password who connected Google can disconnect it', async ({ page }) => {
  const person = await logInAsNewPerson(page)
  await connectFakeGoogle(person.email)
  await page.goto('/settings')
  await expect(page.getByRole('button', { name: /^Google/ })).toContainText('Connected')
  await page.getByRole('button', { name: /^Google/ }).click()
  await page.getByRole('button', { name: 'Disconnect Google' }).click()
  await expect(page.getByRole('button', { name: /^Google/ })).toContainText('Not connected')
  await page.reload()
  await expect(page.getByRole('button', { name: /^Google/ })).toContainText('Not connected')
})

test('log out everywhere ends this session too', async ({ page }) => {
  await logInAsNewPerson(page)
  await openSettings(page)
  await page.getByRole('button', { name: 'Log out everywhere' }).click()
  const ask = page.getByRole('alertdialog', { name: 'Log out everywhere?' })
  await expectAccessible(page)
  await ask.getByRole('button', { name: 'Log out everywhere' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
})

test('the copy of my data line says whom to email', async ({ page }) => {
  await logInAsNewPerson(page)
  await openSettings(page)
  const line = page.getByRole('region', { name: 'Copy of my data' })
  await expect(line).toContainText('oopsproof.app@gmail.com')
  await expect(line).toContainText('within 30 days')
})
