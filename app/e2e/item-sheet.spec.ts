import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './axe'
import { inDays, logInAsNewPerson } from './people'

async function addGym(page: Page) {
  await page.getByRole('button', { name: 'Add Item' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill('Gym')
  await page.getByText('Health').click()
  await page.getByLabel('Due date').fill(await inDays(page, 10))
  await page.getByLabel('Price').fill('35')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

test('change an Item line by line and save', async ({ page }) => {
  await logInAsNewPerson(page)
  await addGym(page)
  await page.getByRole('listitem').filter({ hasText: 'Gym' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Gym' })
  await expect(sheet.getByRole('status')).toHaveText('All changes saved')
  await expectAccessible(page)

  await sheet.getByRole('button', { name: /^Price/ }).click()
  await sheet.getByLabel('Price').fill('39.90')
  await sheet.getByRole('button', { name: /^Due date/ }).click()
  await sheet.getByLabel('Due date').fill(await inDays(page, 2))
  await expect(sheet.getByRole('status')).toHaveText('Unsaved changes')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet.getByRole('status')).toHaveText('Changes saved ✅')
  await expect(sheet.getByText('Due in 2 days')).toBeVisible()

  await sheet.getByRole('button', { name: 'Close' }).filter({ visible: true }).click()
  const row = page.getByRole('region', { name: 'This week' }).getByRole('listitem').filter({ hasText: 'Gym' })
  await expect(row).toContainText('€39.90')
  await expect(row).toContainText('Due in 2 days')
})

test('closing with unsaved changes asks first; Discard keeps the old values', async ({ page }) => {
  await logInAsNewPerson(page)
  await addGym(page)
  await page.getByRole('listitem').filter({ hasText: 'Gym' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Gym' })
  await sheet.getByRole('button', { name: 'Change Name' }).click()
  await sheet.getByLabel('Name', { exact: true }).fill('Gym and pool')

  await sheet.getByRole('button', { name: 'Close' }).filter({ visible: true }).click()
  const ask = page.getByRole('alertdialog', { name: 'Save your changes?' })
  await ask.getByRole('button', { name: 'Keep editing' }).click()
  await expect(sheet.getByLabel('Name', { exact: true })).toHaveValue('Gym and pool')

  await sheet.getByRole('button', { name: 'Close' }).filter({ visible: true }).click()
  await ask.getByRole('button', { name: 'Discard' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('listitem').filter({ hasText: 'Gym' })).not.toContainText('pool')
})

test('Save in the leave question saves, then closes', async ({ page }) => {
  await logInAsNewPerson(page)
  await addGym(page)
  await page.getByRole('listitem').filter({ hasText: 'Gym' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Gym' })
  await sheet.getByRole('button', { name: /^Category/ }).click()
  await sheet.getByText('Home').click()
  await expect(sheet.getByRole('button', { name: /^Category/ })).toContainText('Home')
  await sheet.getByRole('button', { name: 'Close' }).filter({ visible: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('listitem').filter({ hasText: 'Gym' })).toContainText('🏠')
})

test('on a phone, dragging the top bar down closes the sheet; a short drag springs back', async ({ page }, info) => {
  test.skip(info.project.name.startsWith('computer'), 'phone only')
  await logInAsNewPerson(page)
  await addGym(page)
  await page.getByRole('listitem').filter({ hasText: 'Gym' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Gym' })
  const bar = sheet.getByRole('status')
  const box = (await bar.boundingBox())!
  const sheetBox = (await sheet.boundingBox())!

  await page.mouse.move(box.x + box.width / 2, box.y + 5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + 40, { steps: 10 })
  await page.mouse.up()
  await expect(sheet).toBeVisible()

  await page.mouse.move(box.x + box.width / 2, box.y + 5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + sheetBox.height * 0.7, { steps: 10 })
  await page.mouse.up()
  await expect(sheet).toBeHidden()
})

test('tapping outside with unsaved changes asks before leaving', async ({ page }) => {
  await logInAsNewPerson(page)
  await addGym(page)
  await page.getByRole('listitem').filter({ hasText: 'Gym' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Gym' })
  await sheet.getByRole('button', { name: /^Price/ }).click()
  await sheet.getByLabel('Price').fill('40')
  await page.mouse.click(5, 5)
  await expect(page.getByRole('alertdialog', { name: 'Save your changes?' })).toBeVisible()
})

test('an unfinished custom repeat is never saved as "doesn\'t repeat"', async ({ page }) => {
  await logInAsNewPerson(page)
  await addGym(page)
  await page.getByRole('listitem').filter({ hasText: 'Gym' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Gym' })
  await sheet.getByRole('button', { name: /^Repeats/ }).click()
  await sheet.getByRole('combobox', { name: 'Repeats' }).selectOption({ label: 'Custom…' })
  await sheet.getByLabel('Every', { exact: true }).fill('0')
  await sheet.getByRole('button', { name: /^Repeats/ }).click()
  await expect(sheet.getByRole('button', { name: /^Repeats/ })).toContainText('Custom: type how often')
  await sheet.getByRole('button', { name: /^Repeats/ }).click()
  await expect(sheet.getByRole('combobox', { name: 'Repeats' })).toHaveValue('custom')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet.getByRole('alert')).toContainText('Repeat every 1 to 365.')
})
