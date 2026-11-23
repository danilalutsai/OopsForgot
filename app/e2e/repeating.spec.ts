import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './axe'
import { choose, inDays, logInAsNewPerson, pick } from './people'

async function addItem(page: Page, name: string, firstDue: string, repeat?: string, custom?: [string, string]) {
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill(name)
  await page.getByText('Other').click()
  await pick(page.getByLabel('Event date'), firstDue)
  if (repeat) await choose(page.getByRole('combobox', { name: 'Repeats' }).first(), repeat)
  if (custom) {
    await page.getByLabel('Every', { exact: true }).fill(custom[0])
    await choose(page.getByRole('combobox', { name: 'Repeat unit' }), custom[1])
  }
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

test('repeating Events move on to their next Event date; one-time Events become Expired', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Cleaning', await inDays(page, -14), 'Every week')
  await addItem(page, 'Water filter', await inDays(page, -5), 'Custom…', ['10', 'days'])
  await addItem(page, 'Old ID card', await inDays(page, -3))

  const today = page.getByRole('region', { name: 'Today' })
  await expect(today.getByRole('listitem').filter({ hasText: 'Cleaning' })).toContainText(/^Cleaning\s*Today/)
  await expect(today.getByRole('listitem').filter({ hasText: 'Cleaning' })).toContainText('Every week')
  // one-time and past: in Expired, above Today, not in Today
  await expect(today.getByText('Old ID card')).toHaveCount(0)
  await page.getByRole('button', { name: 'Expired', exact: true }).click()
  const expired = page.getByRole('region', { name: 'Expired' })
  await expect(expired.getByRole('listitem').filter({ hasText: 'Old ID card' })).toContainText('Expired 3 days ago')
  const thisWeek = page.getByRole('region', { name: 'This week' })
  await expect(thisWeek.getByRole('listitem').filter({ hasText: 'Water filter' })).toContainText('In 5 days')
  await expect(thisWeek.getByRole('listitem').filter({ hasText: 'Water filter' })).toContainText('Every 10 days')
  await expectAccessible(page)
})

test("Repeats: an app-styled list, with Every day first after Doesn't repeat", async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  const repeats = page.getByRole('combobox', { name: 'Repeats' })
  await expect(repeats).toHaveText("Doesn't repeat")
  await expectAccessible(page)
  await repeats.click()
  await expect(page.getByRole('option')).toHaveText([
    "Doesn't repeat",
    'Every day',
    'Every week',
    'Every month',
    'Every year',
    'Custom…',
  ])
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'New Event' }).getByRole('button', { name: 'Cancel' }).click()

  await addItem(page, 'Vitamins', await inDays(page, 0), 'Every day')
  const today = page.getByRole('region', { name: 'Today' })
  await expect(today.getByRole('listitem').filter({ hasText: 'Vitamins' })).toContainText('Every day')
})
