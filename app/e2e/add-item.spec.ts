import { expect, test } from '@playwright/test'
import { expectAccessible } from './axe'
import { inDays, logInAsNewPerson } from './people'

async function openAddSheet(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Add Item' }).filter({ visible: true }).first().click()
  await expect(page.getByRole('dialog', { name: 'New Item' })).toBeVisible()
}

test('add an Item and see it in the right group', async ({ page }) => {
  await logInAsNewPerson(page)
  await openAddSheet(page)
  await expectAccessible(page)

  await page.getByLabel('Name').fill('Gym')
  await page.getByText('Health').click()
  await page.getByLabel('Due date').fill(await inDays(page, 3))
  await page.getByLabel('Price').fill('35,00')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('status')).toHaveText('Item added')
  const thisWeek = page.getByRole('region', { name: 'This week' })
  await expect(thisWeek.getByText('Gym')).toBeVisible()
  await expect(thisWeek.getByText('Due in 3 days')).toBeVisible()
  await expect(thisWeek.getByText('€35.00')).toBeVisible()
  await expectAccessible(page)
})

test('an Item due today and an Item far ahead land in Today and Later', async ({ page }) => {
  await logInAsNewPerson(page)
  for (const [name, days] of [
    ['Netflix', 0],
    ['Passport', 100],
  ] as const) {
    await openAddSheet(page)
    await page.getByLabel('Name').fill(name)
    await page.getByText('Other').click()
    await page.getByLabel('Due date').fill(await inDays(page, days))
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  }
  await expect(page.getByRole('region', { name: 'Today' }).getByText('Due today')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Later' }).getByText('Passport')).toBeVisible()
  await expectAccessible(page)
})

test('the add form explains what is missing and warns about long numbers', async ({ page }) => {
  await logInAsNewPerson(page)
  await openAddSheet(page)
  await page.getByLabel('Notes').fill('card 4111111111111111')
  await expect(page.getByText("Don't store full card or document numbers here.")).toBeVisible()
  await page.getByLabel('Price').fill('ten')
  await page.getByRole('button', { name: 'Save' }).click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Give the Item a name.')
  await expect(alert).toContainText('Pick a Category.')
  await expect(alert).toContainText('Pick a Due date.')
  await expect(alert).toContainText('Type a price like 12.50')
})

test("after Ana logs out, Ben never sees Ana's Items on the same device", async ({ page }) => {
  await logInAsNewPerson(page, 'Ana')
  await openAddSheet(page)
  await page.getByLabel('Name').fill('Ana passport')
  await page.getByText('Documents').click()
  await page.getByLabel('Due date').fill(await inDays(page, 30))
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Ana passport')).toBeVisible()

  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await logInAsNewPerson(page, 'Ben', 'Tester')
  await expect(page.getByText('Ana passport')).toHaveCount(0)
})

test('on a phone, empty date and time fields look empty, not filled with an example', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('phone'), 'touch screens show an example value in empty fields')
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Item' }).filter({ visible: true }).first().click()
  const date = page.getByLabel('Due date')
  const time = page.getByLabel('Time', { exact: true })
  const textColor = (field: typeof date) => field.evaluate((el) => getComputedStyle(el).color)

  await date.fill('')
  await date.blur()
  expect(await textColor(date)).toBe('rgba(0, 0, 0, 0)')
  expect(await textColor(time)).toBe('rgba(0, 0, 0, 0)')
  // still a full-height field, like the others
  expect((await date.boundingBox())!.height).toBeGreaterThanOrEqual(40)

  await date.fill(await inDays(page, 3))
  await time.fill('09:30')
  expect(await textColor(date)).not.toBe('rgba(0, 0, 0, 0)')
  expect(await textColor(time)).not.toBe('rgba(0, 0, 0, 0)')
})

test('New Item sheet: Due date, then Time, stacked; no time reads "No time (all day)"', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Item' }).filter({ visible: true }).first().click()
  const sheet = page.getByRole('dialog')
  const date = (await sheet.getByLabel('Due date').boundingBox())!
  const time = (await sheet.getByLabel('Time', { exact: true }).boundingBox())!
  // stacked, same width, Time below Due date
  expect(time.y).toBeGreaterThanOrEqual(date.y + date.height)
  expect(Math.abs(time.x - date.x)).toBeLessThan(1)
  expect(Math.abs(time.width - date.width)).toBeLessThan(1)
  // the hint sits under Time
  const hint = (await sheet.getByText('Optional. Needed for Reminders hours before.').boundingBox())!
  expect(hint.y).toBeGreaterThanOrEqual(time.y + time.height)

  await expect(sheet.getByText('No time (all day)')).toBeVisible()
  await expect(sheet.getByText('Choose a date')).toBeVisible()
  await sheet.getByLabel('Due date').fill(await inDays(page, 3))
  await sheet.getByLabel('Time', { exact: true }).fill('09:30')
  await sheet.getByLabel('Name').click()
  await expect(sheet.getByText('No time (all day)')).toBeHidden()
  await expect(sheet.getByText('Choose a date')).toBeHidden()
})
