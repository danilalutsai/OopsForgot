import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './axe'
import { inDays, logInAsNewPerson } from './people'

async function addItem(page: Page, name: string, days: number) {
  await page.getByRole('button', { name: 'Add Item' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill(name)
  await page.getByText('Other').click()
  await page.getByLabel('Due date').fill(await inDays(page, days))
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

const row = (page: Page, name: string) => page.getByRole('listitem').filter({ hasText: name })

async function swipe(page: Page, name: string, dx: number) {
  const box = (await row(page, name).boundingBox())!
  const y = box.y + box.height / 2
  const x = box.x + box.width / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y, { steps: 12 })
  await page.mouse.up()
}

test('mark an Item Handled in place, then undo it', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Netflix', 2)
  await page.getByRole('button', { name: 'Mark Netflix Handled' }).click()
  await expect(row(page, 'Netflix')).toContainText('Handled')
  await expect(page.getByRole('region', { name: 'This week' }).getByText('Netflix')).toBeVisible()
  await expectAccessible(page)

  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(row(page, 'Netflix')).toContainText('Due in 2 days')
})

test('swipe an Item to Handled, then to Archive; restore it from Archived', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Gym', 3)
  await swipe(page, 'Gym', 150)
  await expect(page.getByRole('button', { name: 'Undo Handled for Gym' })).toBeVisible()
  await swipe(page, 'Gym', -150)
  await expect(page.getByRole('status')).toContainText('Gym archived')
  await expect(page.getByRole('region', { name: 'This week' })).toBeHidden()

  await page.getByRole('button', { name: 'Archived (1)' }).click()
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByRole('region', { name: 'This week' }).getByText('Gym')).toBeVisible()
})

test('delete an Item from its sheet after confirming, and undo it', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Old card', 40)
  await page
    .getByRole('button', { name: /Old card/ })
    .first()
    .click()
  await page.getByRole('dialog', { name: 'Old card' }).getByRole('button', { name: 'Delete' }).click()
  const ask = page.getByRole('alertdialog', { name: 'Delete Old card?' })
  await expect(ask).toContainText('Gone for good.')
  await ask.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('status')).toContainText('Old card deleted')
  await expect(row(page, 'Old card')).toHaveCount(0)

  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(row(page, 'Old card')).toBeVisible()
})

test('a Handled repeating Item reminds again for its next Due date', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Item' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill('Cleaning')
  await page.getByText('Home').click()
  await page.getByLabel('Due date').fill(await inDays(page, -7))
  await page.getByRole('combobox', { name: 'Repeats' }).selectOption({ label: 'Every week' })
  await page.getByRole('button', { name: 'Save' }).click()
  // Handled for last week's Due date does not carry over to today's
  await expect(row(page, 'Cleaning')).toContainText('Due today')
  await page.getByRole('button', { name: 'Mark Cleaning Handled' }).click()
  await expect(row(page, 'Cleaning')).toContainText('Handled')
})
