import { expect, test } from '@playwright/test'
import { expectAccessible } from './axe'
import { logInAsNewPerson } from './people'

test('change the day Reminder time in Settings', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expectAccessible(page)

  const line = page.getByRole('button', { name: /^Day Reminders at/ })
  await line.click()
  await page.getByLabel('Day Reminders at').fill('08:07')
  await page.getByLabel('Day Reminders at').blur()
  await expect(page.getByRole('status')).toHaveText('Saved')
  await expect(page.getByLabel('Day Reminders at')).toHaveValue('08:00')
  await page.getByLabel('Day Reminders at').fill('08:10')
  await page.getByLabel('Day Reminders at').blur()
  await expect(page.getByLabel('Day Reminders at')).toHaveValue('08:00')

  await page.getByRole('button', { name: 'Back to 12:00' }).click()
  await expect(page.getByLabel('Day Reminders at')).toHaveValue('12:00')
})

test('a device in another time zone gets an amber gear and an "Update time zone?" question', async ({ page }) => {
  await logInAsNewPerson(page, 'Ana', 'Tester', 'Pacific/Auckland')
  const gear = page.getByRole('link', { name: 'Settings' })
  await expect(gear.locator('span')).toBeVisible()
  await gear.click()
  await expect(page.getByRole('heading', { name: 'Update time zone?' })).toBeVisible()
  await page.getByRole('button', { name: 'Use new' }).click()
  await expect(page.getByRole('heading', { name: 'Update time zone?' })).toBeHidden()
  await expect(page.getByRole('button', { name: /^Time zone/ })).not.toContainText('Pacific/Auckland')
})

test('change currency and name; the avatar follows', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: /^Currency/ }).click()
  await expect(page.getByText('Existing amounts are not converted.')).toBeVisible()
  await page.getByLabel('Currency').selectOption('USD')
  await expect(page.getByRole('button', { name: /^Currency/ })).toContainText('USD')

  await page.reload()
  await page.getByRole('button', { name: /^Profile/ }).click()
  await expect(page.getByLabel('Surname')).toHaveValue('García López')
  await page.getByLabel('Name', { exact: true }).fill('Anna')
  await page.getByLabel('Name', { exact: true }).blur()
  await expect(page.getByRole('button', { name: /^Profile/ })).toContainText('Anna García López')
  await page.goto('/')
  await expect(page.getByText('Welcome, Anna')).toBeVisible()
  await expect(page.getByRole('button', { name: /Account/ })).toContainText('AG')
})

test('add and remove a profile photo', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: /^Profile/ }).click()
  // any real image will do: a small screenshot of the page itself
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 60, height: 40 } })
  await page.getByLabel('Photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('status')).toHaveText('Saved')
  await expect(page.getByRole('button', { name: 'Change photo' })).toBeVisible()
  await expect(page.locator('img').first()).toHaveAttribute('src', /avatars/)

  await page.getByRole('button', { name: 'Remove photo' }).click()
  await expect(page.getByRole('button', { name: 'Add photo' })).toBeVisible()
  await expect(page.locator('img')).toHaveCount(0)
})
