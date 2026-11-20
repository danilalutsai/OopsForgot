import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './axe'
import { logInAsNewPerson } from './people'

async function addExpense(page: Page, amount: string, category: string, description = '') {
  await page.getByRole('button', { name: 'Add Expense' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New Expense' })
  await sheet.getByLabel('Amount').fill(amount)
  await sheet.getByText(category, { exact: true }).click()
  if (description) await sheet.getByLabel('Description').fill(description)
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
}

test('a new month is empty; adding an Expense changes the total', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('link', { name: 'Money' }).filter({ visible: true }).click()
  await expect(page.getByText('No Expenses this month')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous month' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled()
  await expectAccessible(page)

  await addExpense(page, '62,40', 'Subscriptions', 'Phone plan')
  await addExpense(page, '12.50', 'Other', 'Lunch')
  await expect(page.getByRole('img', { name: /€74\.90 spent/ })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Spending by Category' })).toContainText('Subscriptions · €62.40')
  await expect(page.getByRole('listitem').filter({ hasText: 'Phone plan' })).toContainText('€62.40')
  await expectAccessible(page)
})

test('tap a Category to filter; + Expense then starts on that Category', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('link', { name: 'Money' }).filter({ visible: true }).click()
  await addExpense(page, '30', 'Home', 'Plants')
  await addExpense(page, '10', 'Other', 'Coffee')
  await page.getByRole('group', { name: 'Spending by Category' }).getByRole('button', { name: /Home/ }).click()
  await expect(page.getByText('Showing Home only')).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(1)

  await page.getByRole('button', { name: 'Add Expense' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New Expense' })
  await expect(sheet.getByRole('radio', { name: /Home/ })).toBeChecked()
  await expect(sheet.getByText('Free trials')).toHaveCount(0)
})

test('edit an Expense amount, then delete it after confirming', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('link', { name: 'Money' }).filter({ visible: true }).click()
  await addExpense(page, '20', 'Health', 'Pharmacy')
  await page.getByRole('listitem').filter({ hasText: 'Pharmacy' }).getByRole('button').click()
  const sheet = page.getByRole('dialog', { name: 'Expense' })
  await sheet.getByLabel('Amount').fill('25')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Pharmacy' })).toContainText('€25.00')

  await page.getByRole('listitem').filter({ hasText: 'Pharmacy' }).getByRole('button').click()
  await page.getByRole('dialog', { name: 'Expense' }).getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog', { name: 'Delete this Expense?' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('No Expenses this month')).toBeVisible()
})

test('priced Events due later this month show as still coming; tapping one opens it', async ({ page }) => {
  await logInAsNewPerson(page)
  const tomorrow = await page.evaluate(() => {
    const d = new Date()
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    return t.getMonth() === d.getMonth() ? t.toLocaleDateString('en-CA') : null
  })
  test.skip(!tomorrow, 'last day of the month: nothing can still be coming')
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill('Gym')
  await page.getByText('Health').click()
  await page.getByLabel('Event date').fill(tomorrow!)
  await page.getByLabel('Price').fill('35')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.getByRole('link', { name: 'Money' }).filter({ visible: true }).click()
  await expect(page.getByText('Still coming €35.00')).toBeVisible()
  await expect(page.getByRole('img', { name: /€0\.00 spent/ })).toBeVisible()
  const list = page.getByRole('list', { name: 'Still coming this month' })
  await list.getByRole('button', { name: /Gym/ }).click()
  await expect(page.getByRole('dialog', { name: 'Gym' })).toBeVisible()
})

test('a long Event name in still coming stays on screen instead of widening the page', async ({ page }) => {
  await logInAsNewPerson(page)
  const tomorrow = await page.evaluate(() => {
    const d = new Date()
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    return t.getMonth() === d.getMonth() ? t.toLocaleDateString('en-CA') : null
  })
  test.skip(!tomorrow, 'last day of the month: nothing can still be coming')
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill('Gym membership with a very long name that would not fit on a phone screen at all')
  await page.getByText('Health').click()
  await page.getByLabel('Event date').fill(tomorrow!)
  await page.getByLabel('Price').fill('35')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.getByRole('link', { name: 'Money' }).filter({ visible: true }).click()
  await expect(page.getByRole('list', { name: 'Still coming this month' })).toBeVisible()
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(sideways).toBeLessThanOrEqual(0)
})
