import { expect, test } from '@playwright/test'
import { expectAccessible } from './axe'
import { logInAsNewGooglePerson, openFromAvatar } from './people'

test('signup and login offer Google', async ({ page }) => {
  for (const path of ['/signup', '/login']) {
    await page.goto(path)
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  }
})

test('after a Google signup: check the names, confirm 16+, then the app opens', async ({ page }) => {
  await logInAsNewGooglePerson(page, { full_name: 'Cher' })
  await expect(page.getByRole('heading', { name: 'Nice to meet you, Cher' })).toBeVisible()
  await expectAccessible(page)
  // the app stays closed until the welcome is done
  await page.goto('/money')
  await expect(page).toHaveURL(/\/welcome/)

  await page.getByLabel('Surname').fill('Sarkisian')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('alert')).toHaveText('OopsForgot is for people 16 or older.')
  await page.getByLabel('I am 16 or older').check()
  await page.getByRole('button', { name: 'Continue' }).click()
  // back to where they were going
  await expect(page).toHaveURL(/\/money$/)
  await page.goto('/')
  await expect(page.getByText('Welcome, Cher')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Account' })).toHaveText('CS')
})

test('a Google-only account deletes without a password', async ({ page }) => {
  await logInAsNewGooglePerson(page)
  await page.getByLabel('I am 16 or older').check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await openFromAvatar(page, 'Account')
  await page.getByRole('button', { name: 'Delete account' }).click()
  const ask = page.getByRole('alertdialog', { name: 'Delete your account?' })
  await expect(ask.getByLabel('Your password')).toHaveCount(0)
  await expect(ask.getByRole('button', { name: 'Sign in with Google again' })).toBeVisible()
  await ask.getByLabel('Type DELETE to confirm').fill('DELETE')
  // just signed in, so no new Google sign-in is needed yet
  await ask.getByRole('button', { name: 'Delete my account' }).click()
  await expect(page.getByText('Your account and everything in it have been deleted.')).toBeVisible()
})

test('someone under 16 removes their Google signup straight away', async ({ page }) => {
  const kid = await logInAsNewGooglePerson(page, { full_name: 'Kid Young' })
  await page.getByRole('button', { name: 'I’m not 16 yet: remove my signup' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await page.getByLabel('Email').fill(kid.email)
  await page.getByLabel('Password').fill(kid.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toHaveText("That email and password don't match an account.")
})

test('a Google photo can be replaced, and removing a photo leaves the initials', async ({ page }) => {
  // the Google photo itself never loads in tests; only where the picture comes from matters here
  await logInAsNewGooglePerson(page, { full_name: 'Greg Krohon', avatar_url: 'https://example.test/greg.jpg' })
  await page.getByLabel('I am 16 or older').check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await openFromAvatar(page, 'Account')
  await page.getByRole('button', { name: /^Photo/ }).click()
  await expect(page.locator('img').first()).toHaveAttribute('src', 'https://example.test/greg.jpg')

  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 60, height: 40 } })
  await page.getByLabel('Photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('button', { name: 'Change photo' })).toBeVisible()
  await expect(page.locator('img').first()).toHaveAttribute('src', /avatars/)

  await page.getByRole('button', { name: 'Remove photo' }).click()
  await expect(page.getByRole('button', { name: 'Add photo' })).toBeVisible()
  // not back to the Google photo: the initials, after a reload too
  await expect(page.locator('img')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: /Account menu/ })).toContainText('GK')
  await expect(page.locator('img')).toHaveCount(0)
})

test('the Google photo can be removed straight away', async ({ page }) => {
  await logInAsNewGooglePerson(page, { full_name: 'Greg Krohon', avatar_url: 'https://example.test/greg.jpg' })
  await page.getByLabel('I am 16 or older').check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await openFromAvatar(page, 'Account')
  await page.getByRole('button', { name: /^Photo/ }).click()
  await page.getByRole('button', { name: 'Remove photo' }).click()
  await expect(page.getByRole('button', { name: 'Add photo' })).toBeVisible()
  await expect(page.locator('img')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Account menu/ })).toContainText('GK')
})
