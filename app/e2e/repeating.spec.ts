import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './axe'
import { inDays, logInAsNewPerson } from './people'

async function addItem(page: Page, name: string, firstDue: string, repeat?: string, custom?: [string, string]) {
  await page.getByRole('button', { name: 'Add Item' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill(name)
  await page.getByText('Other').click()
  await page.getByLabel('Due date').fill(firstDue)
  if (repeat) await page.getByRole('combobox', { name: 'Repeats' }).first().selectOption({ label: repeat })
  if (custom) {
    await page.getByLabel('Every', { exact: true }).fill(custom[0])
    await page.getByRole('combobox', { name: 'Repeat unit' }).selectOption({ label: custom[1] })
  }
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

test('repeating Items move on to their next Due date; one-time Items become Expired', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Cleaning', await inDays(page, -14), 'Every week')
  await addItem(page, 'Water filter', await inDays(page, -5), 'Custom…', ['10', 'days'])
  await addItem(page, 'Old ID card', await inDays(page, -3))

  const today = page.getByRole('region', { name: 'Today' })
  await expect(today.getByRole('listitem').filter({ hasText: 'Cleaning' })).toContainText('Due today')
  await expect(today.getByRole('listitem').filter({ hasText: 'Cleaning' })).toContainText('Every week')
  // one-time and past: in Expired, above Today, not in Today
  await expect(today.getByText('Old ID card')).toHaveCount(0)
  await page.getByRole('button', { name: 'Expired', exact: true }).click()
  const expired = page.getByRole('region', { name: 'Expired' })
  await expect(expired.getByRole('listitem').filter({ hasText: 'Old ID card' })).toContainText('Expired 3 days ago')
  const thisWeek = page.getByRole('region', { name: 'This week' })
  await expect(thisWeek.getByRole('listitem').filter({ hasText: 'Water filter' })).toContainText('Due in 5 days')
  await expect(thisWeek.getByRole('listitem').filter({ hasText: 'Water filter' })).toContainText('Every 10 days')
  await expectAccessible(page)
})
