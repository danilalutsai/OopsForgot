import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './axe'
import { inDays, logInAsNewPerson } from './people'

async function addItem(page: Page, name: string, days: number, repeat?: string) {
  await page.getByRole('button', { name: 'Add Item' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill(name)
  await page.getByText('Other').click()
  await page.getByLabel('Due date').fill(await inDays(page, days))
  if (repeat) await page.getByRole('combobox', { name: 'Repeats' }).selectOption({ label: repeat })
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

/** "16 November" in the browser's own format, as the calendar labels days. */
const dayName = (page: Page, days: number) =>
  page.evaluate((n) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d.toLocaleDateString(navigator.language, { day: 'numeric', month: 'long' })
  }, days)

test('the calendar shows Items on their Due dates; tapping a day lists them', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Netflix', 0)
  await addItem(page, 'Cleaning', 0, 'Every week')
  await page.getByRole('tab', { name: 'Calendar' }).click()

  await expect(page.getByRole('button', { name: `${await dayName(page, 0)}, 2 Items` })).toBeVisible()
  await expect(page.getByRole('button', { name: `${await dayName(page, 7)}, 1 Item` })).toBeVisible()
  await expectAccessible(page)

  await page.getByRole('button', { name: `${await dayName(page, 7)}, 1 Item` }).click()
  const list = page.getByRole('region', { name: new RegExp(await dayName(page, 7)) })
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(list.getByText('Cleaning')).toBeVisible()
  await expect(list.getByText('Due in 7 days')).toBeVisible()
})

test('week view, moving between pages, and back to Today', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('tab', { name: 'Calendar' }).click()
  await page.getByRole('button', { name: 'Week' }).click()
  await expect(page.locator('.grid-cols-7 > button')).toHaveCount(7)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('button', { name: new RegExp(`^${await dayName(page, 0)},`) })).toHaveCount(0)
  await page.getByRole('button', { name: 'Today' }).click()
  await expect(page.getByRole('button', { name: new RegExp(`^${await dayName(page, 0)},`) })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('Handled from the calendar day list', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Gym', 0)
  await page.getByRole('tab', { name: 'Calendar' }).click()
  await page.getByRole('button', { name: 'Mark Gym Handled' }).click()
  await expect(page.getByRole('button', { name: 'Undo Handled for Gym' })).toBeVisible()
  await page.getByRole('tab', { name: 'List' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Gym' })).toContainText('Handled')
})

test('Handled is offered only for the Due date an Item is on now', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Cleaning', 0, 'Every week')
  await page.getByRole('tab', { name: 'Calendar' }).click()
  await page.getByRole('button', { name: 'Mark Cleaning Handled' }).click()
  await page.getByRole('button', { name: `${await dayName(page, 7)}, 1 Item` }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Cleaning' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Handled for Cleaning|Mark Cleaning Handled/ })).toHaveCount(0)
  await page.getByRole('tab', { name: 'List' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Cleaning' })).toContainText('Handled')
})

test('arrow keys move between List and Calendar', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('tab', { name: 'List' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Calendar' })).toBeFocused()
  await expect(page.getByRole('tabpanel', { name: 'Calendar' })).toBeVisible()
})
