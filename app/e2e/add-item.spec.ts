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
