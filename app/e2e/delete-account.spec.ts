import { expect, test } from '@playwright/test'
import { expectAccessible } from './axe'
import { logInAsNewPerson } from './people'

test('delete the account: password and DELETE, then everything is gone', async ({ page }) => {
  const person = await logInAsNewPerson(page)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Delete account' }).click()
  const ask = page.getByRole('alertdialog', { name: 'Delete your account?' })
  await expectAccessible(page)

  await ask.getByLabel('Your password').fill('wrong-password-1')
  await ask.getByLabel('Type DELETE to confirm').fill('DELETE')
  await ask.getByRole('button', { name: 'Delete my account' }).click()
  await expect(ask.getByRole('alert')).toHaveText('That password isn’t right.')

  await ask.getByLabel('Your password').fill(person.password)
  await ask.getByRole('button', { name: 'Delete my account' }).click()
  await expect(page.getByText('Your account and everything in it have been deleted.')).toBeVisible()

  await page.getByLabel('Email').fill(person.email)
  await page.getByLabel('Password').fill(person.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toHaveText("That email and password don't match an account.")
})
