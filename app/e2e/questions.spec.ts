import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './axe'
import { inDays, logInAsNewPerson } from './people'

async function addItem(page: Page, name: string, category: string, days: number) {
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill(name)
  await page.getByText(category, { exact: true }).click()
  await page.getByLabel('Event date').fill(await inDays(page, days))
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}
const row = (page: Page, name: string) => page.getByRole('listitem').filter({ hasText: name })
/** Expired Items wait above Today, hidden until asked for. */
const showExpired = (page: Page) => page.getByRole('button', { name: 'Expired', exact: true }).click()

test('an Expired Event asks "What now?"; a new Event date answers it', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'ID card', 'Documents', -3)
  await showExpired(page)
  await expect(row(page, 'ID card').getByRole('button', { name: 'What now?' })).toBeVisible()
  await row(page, 'ID card').getByRole('button', { name: 'What now?' }).click()

  const sheet = page.getByRole('dialog', { name: 'ID card' })
  await expect(sheet.getByRole('heading', { name: 'Expired 3 days ago. What now?' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Handled', exact: true })).toHaveCount(0)
  await expectAccessible(page)

  await sheet.getByLabel('New Event date').fill(await inDays(page, 365))
  await sheet.getByRole('button', { name: 'Set date' }).click()
  await expect(sheet.getByRole('heading', { name: /What now/ })).toBeHidden()
  await expect(sheet.getByText('In 365 days')).toBeVisible()
})

test('"Make it repeat" counts the next Event date forward from the old one', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Window cleaning', 'Home', -7)
  await showExpired(page)
  await row(page, 'Window cleaning').getByRole('button', { name: 'What now?' }).click()
  const sheet = page.getByRole('dialog', { name: 'Window cleaning' })
  await sheet.getByLabel('Repeat').selectOption({ label: 'Every week' })
  await sheet.getByRole('button', { name: 'Make it repeat' }).click()
  await expect(sheet.getByText('Today', { exact: true })).toBeVisible()
  await expect(sheet.getByRole('button', { name: /^Repeats/ })).toContainText('Every week')
})

test('a free trial asks "Kept it?"; Yes makes it a monthly Subscription', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Disney+ free trial', 'Free trials', 0)
  await row(page, 'Disney+').getByRole('button', { name: 'Kept it?' }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('heading', { name: 'Did you keep Disney+ free trial?' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Yes, I kept it' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'monthly Subscription' })).toContainText(
    'Disney+ is now a monthly Subscription',
  )
  await expect(sheet.getByRole('button', { name: /^Category/ })).toContainText('Subscriptions')
  await expect(sheet.getByRole('button', { name: /^Repeats/ })).toContainText('Every month')
})

test('a free trial not kept stays, with no more question; Expired from the next day', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Duolingo free trial', 'Free trials', 0)
  await row(page, 'Duolingo').getByRole('button', { name: 'Kept it?' }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: 'No, I cancelled' }).click()
  await expect(sheet.getByRole('heading', { name: /Did you keep/ })).toBeHidden()
  await sheet.getByRole('button', { name: 'Close' }).filter({ visible: true }).click()
  await expect(row(page, 'Duolingo')).toBeVisible()
  await expect(row(page, 'Duolingo').getByRole('button', { name: 'Kept it?' })).toHaveCount(0)
})

test('"Keep in Expired" closes the question; the Event stays in Expired', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Old passport', 'Documents', -4)
  await showExpired(page)
  await row(page, 'Old passport').getByRole('button', { name: 'What now?' }).click()
  const sheet = page.getByRole('dialog', { name: 'Old passport' })
  await expect(sheet.getByRole('button', { name: 'Archive' })).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Keep in Expired' }).click()
  await expect(sheet.getByRole('heading', { name: /What now/ })).toBeHidden()
  await sheet.getByRole('button', { name: 'Close' }).filter({ visible: true }).click()

  const expired = page.getByRole('region', { name: 'Expired' })
  await expect(expired.getByText('Old passport')).toBeVisible()
  await expect(row(page, 'Old passport').getByRole('button', { name: 'What now?' })).toHaveCount(0)
  await page.reload()
  await showExpired(page)
  await expect(row(page, 'Old passport').getByRole('button', { name: 'What now?' })).toHaveCount(0)
})

test('a past date cannot answer "What now?"', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Visa', 'Travel', -2)
  await showExpired(page)
  await row(page, 'Visa').getByRole('button', { name: 'What now?' }).click()
  const sheet = page.getByRole('dialog', { name: 'Visa' })
  await sheet.getByLabel('New Event date').fill(await inDays(page, -1))
  await expect(sheet.getByRole('button', { name: 'Set date' })).toBeDisabled()
})

test('rows with a question stay readable in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await logInAsNewPerson(page)
  await addItem(page, 'Old ID', 'Documents', -3)
  await addItem(page, 'Trial', 'Free trials', 0)
  await showExpired(page)
  await expect(row(page, 'Old ID').getByRole('button', { name: 'What now?' })).toBeVisible()
  await expectAccessible(page)
})
