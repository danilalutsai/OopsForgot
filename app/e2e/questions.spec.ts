import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './axe'
import { inDays, logInAsNewPerson } from './people'

async function addItem(page: Page, name: string, category: string, days: number) {
  await page.getByRole('button', { name: 'Add Item' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill(name)
  await page.getByText(category, { exact: true }).click()
  await page.getByLabel('Due date').fill(await inDays(page, days))
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}
const row = (page: Page, name: string) => page.getByRole('listitem').filter({ hasText: name })

test('an Expired Item asks "What now?"; a new Due date answers it', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'ID card', '🪪 Documents', -3)
  await expect(row(page, 'ID card').getByRole('button', { name: 'What now?' })).toBeVisible()
  await row(page, 'ID card').getByRole('button', { name: 'What now?' }).click()

  const sheet = page.getByRole('dialog', { name: 'ID card' })
  await expect(sheet.getByRole('heading', { name: 'Expired 3 days ago. What now?' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Handled', exact: true })).toHaveCount(0)
  await expectAccessible(page)

  await sheet.getByLabel('New Due date').fill(await inDays(page, 365))
  await sheet.getByRole('button', { name: 'Set date' }).click()
  await expect(sheet.getByRole('heading', { name: /What now/ })).toBeHidden()
  await expect(sheet.getByText('Due in 365 days')).toBeVisible()
})

test('"Make it repeat" counts the next Due date forward from the old one', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Window cleaning', '🏠 Home', -7)
  await row(page, 'Window cleaning').getByRole('button', { name: 'What now?' }).click()
  const sheet = page.getByRole('dialog', { name: 'Window cleaning' })
  await sheet.getByLabel('Repeat').selectOption({ label: 'Every week' })
  await sheet.getByRole('button', { name: 'Make it repeat' }).click()
  await expect(sheet.getByText('Due today')).toBeVisible()
  await expect(sheet.getByRole('button', { name: /^Repeats/ })).toContainText('Every week')
})

test('a free trial asks "Kept it?"; Yes makes it a monthly Subscription', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Disney+ free trial', '⏳ Free trials', 0)
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

test('a free trial not kept is archived', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Duolingo free trial', '⏳ Free trials', 0)
  await row(page, 'Duolingo').getByRole('button', { name: 'Kept it?' }).click()
  await page.getByRole('button', { name: 'No, I cancelled' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'archived' })).toContainText('Duolingo free trial archived')
  await expect(page.getByRole('button', { name: 'Archived (1)' })).toBeVisible()
})
