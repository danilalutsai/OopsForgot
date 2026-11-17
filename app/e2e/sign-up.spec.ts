import { expect, test } from '@playwright/test'
import { expectAccessible } from './axe'
import { clearInbox, linkFromEmail } from './inbox'

test('sign up, confirm the email, log in, then log out', async ({ page }) => {
  const email = `ana.${crypto.randomUUID()}@example.test`
  const password = 'correct-horse-battery'

  await page.goto('/signup')
  await expectAccessible(page)
  await page.getByLabel('Name', { exact: true }).fill('Ana')
  await page.getByLabel('Surname').fill('García López')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByLabel('I am 16 or older').check()
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByRole('heading', { name: 'Almost there, Ana 👋' })).toBeVisible()

  await page.goto(await linkFromEmail(email))
  await expect(page.getByText('Welcome, Ana 👋')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Account' })).toHaveText('AG')
  await expectAccessible(page)

  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('Welcome, Ana 👋')).toBeVisible()
})

test('signup is refused without the 16+ confirmation', async ({ page }) => {
  await page.goto('/signup')
  await page.getByLabel('Name', { exact: true }).fill('Young')
  await page.getByLabel('Surname').fill('Person')
  await page.getByLabel('Email').fill(`young.${crypto.randomUUID()}@example.test`)
  await page.getByLabel('Password').fill('correct-horse-battery')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByRole('alert')).toHaveText('OopsProof is for people 16 or older.')
})

test('a forgotten password can be reset by email', async ({ page }) => {
  const email = `ben.${crypto.randomUUID()}@example.test`
  await page.goto('/signup')
  await page.getByLabel('Name', { exact: true }).fill('Ben')
  await page.getByLabel('Surname').fill('Tester')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('first-password-1')
  await page.getByLabel('I am 16 or older').check()
  await page.getByRole('button', { name: 'Sign up' }).click()
  await page.goto(await linkFromEmail(email))
  await expect(page.getByText('Welcome, Ben')).toBeVisible()
  await clearInbox(email)
  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()

  await page.getByRole('link', { name: 'Forgot your password?' }).click()
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send link' }).click()
  await expect(page.getByText('a link to set a new password is on its way')).toBeVisible()

  await page.goto(await linkFromEmail(email))
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible()
  await page.getByLabel('New password').fill('second-password-2')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.getByText('Welcome, Ben')).toBeVisible()

  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('second-password-2')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('Welcome, Ben')).toBeVisible()
})

test('an expired reset link offers a new one', async ({ page }) => {
  await page.goto('/reset-password#error=access_denied&error_code=otp_expired')
  await expect(page.getByRole('heading', { name: 'This link no longer works' })).toBeVisible()
  await page.getByRole('link', { name: 'Send a new link' }).click()
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
})
