import { expect, test } from '@playwright/test'
import { expectAccessible } from './axe'
import { inDays, logInAsNewPerson } from './people'

test('pick Reminders when adding an Item; only fitting ones are offered', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Item' }).filter({ visible: true }).first().click()
  const form = page.getByRole('dialog', { name: 'New Item' })
  const chip = (name: string) =>
    form.getByRole('group', { name: 'Reminders' }).getByRole('button', { name, exact: true })

  await expect(chip('1 day')).toHaveAttribute('aria-pressed', 'true')
  await expect(chip('1 hour')).toBeDisabled()
  await expect(form.getByText('Hour Reminders need a time.')).toBeVisible()
  await expect(form.getByText('Day Reminders arrive at')).toBeVisible()

  await form.getByLabel('Name').fill('Dentist')
  await form.getByText('Health').click()
  await form.getByLabel('Due date').fill(await inDays(page, 30))
  await form.getByLabel('Time').fill('09:30')
  await expect(chip('1 hour')).toBeEnabled()
  await chip('1 hour').click()
  await chip('1 week').click()
  await expectAccessible(page)
  await form.getByRole('button', { name: 'Save' }).click()

  await page.getByRole('listitem').filter({ hasText: 'Dentist' }).getByRole('button').first().click()
  await expect(page.getByRole('dialog', { name: 'Dentist' }).getByRole('button', { name: /^Reminders/ })).toContainText(
    '1 hour before, 1 day before, 1 week before',
  )
})

test('a weekly Item cannot have Reminders a week or more before', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Item' }).filter({ visible: true }).first().click()
  const form = page.getByRole('dialog', { name: 'New Item' })
  await form.getByLabel('Due date').fill(await inDays(page, 3))
  await form.getByRole('combobox', { name: 'Repeats' }).selectOption({ label: 'Every week' })
  const group = form.getByRole('group', { name: 'Reminders' })
  await expect(group.getByRole('button', { name: '2 days', exact: true })).toBeEnabled()
  await expect(group.getByRole('button', { name: '1 week', exact: true })).toBeDisabled()
  await expect(form.getByText('Some are longer than one repeat.')).toBeVisible()
})

test('change Reminders in the sheet; ones that no longer fit are dropped on save', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Item' }).filter({ visible: true }).first().click()
  const form = page.getByRole('dialog', { name: 'New Item' })
  await form.getByLabel('Name').fill('Flight')
  await form.getByText('Travel').click()
  await form.getByLabel('Due date').fill(await inDays(page, 20))
  await form.getByLabel('Time').fill('07:00')
  await form.getByRole('group', { name: 'Reminders' }).getByRole('button', { name: '4 hours', exact: true }).click()
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toBeHidden()

  await page.getByRole('listitem').filter({ hasText: 'Flight' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Flight' })
  await sheet.getByRole('button', { name: /^Time/ }).click()
  await sheet.getByRole('button', { name: 'No time' }).click()
  await sheet.locator('header').getByRole('button', { name: 'Save' }).click()
  await expect(sheet.locator('header').getByRole('status')).toHaveText('Changes saved ✅')
  await expect(sheet.getByRole('button', { name: /^Reminders/ })).toContainText('1 day before')
  await expect(sheet.getByRole('button', { name: /^Reminders/ })).not.toContainText('4 hours')
})
