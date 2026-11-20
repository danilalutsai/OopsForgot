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
  await page.getByLabel('Event date').fill(await inDays(page, 3))
  await page.getByLabel('Price').fill('35,00')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('status')).toHaveText('Item added')
  const thisWeek = page.getByRole('region', { name: 'This week' })
  await expect(thisWeek.getByText('Gym')).toBeVisible()
  await expect(thisWeek.getByText('In 3 days')).toBeVisible()
  await expect(thisWeek.getByText('€35.00')).toBeVisible()
  await expectAccessible(page)
})

test('an Item for today and an Item far ahead land in Today and Later', async ({ page }) => {
  await logInAsNewPerson(page)
  for (const [name, days] of [
    ['Netflix', 0],
    ['Passport', 100],
  ] as const) {
    await openAddSheet(page)
    await page.getByLabel('Name').fill(name)
    await page.getByText('Other').click()
    await page.getByLabel('Event date').fill(await inDays(page, days))
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  }
  await expect(page.getByRole('region', { name: 'Today' }).getByRole('listitem')).toContainText(/^Netflix\s*Today/)
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
  await expect(alert).toContainText('Pick an Event date.')
  await expect(alert).toContainText('Type a price like 12.50')
})

test("after Ana logs out, Ben never sees Ana's Items on the same device", async ({ page }) => {
  await logInAsNewPerson(page, 'Ana')
  await openAddSheet(page)
  await page.getByLabel('Name').fill('Ana passport')
  await page.getByText('Documents').click()
  await page.getByLabel('Event date').fill(await inDays(page, 30))
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
  const date = page.getByLabel('Event date')
  const time = page.getByLabel('Start time')
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

test('New Item sheet: Event date, Start time and Finish time, stacked; empty Start reads "All day"', async ({
  page,
}) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Item' }).filter({ visible: true }).first().click()
  const sheet = page.getByRole('dialog')
  const date = (await sheet.getByLabel('Event date').boundingBox())!
  const start = (await sheet.getByLabel('Start time').boundingBox())!
  const finish = (await sheet.getByLabel('Finish time').boundingBox())!
  // stacked, same width: Event date, then Start, then Finish
  expect(start.y).toBeGreaterThanOrEqual(date.y + date.height)
  expect(finish.y).toBeGreaterThanOrEqual(start.y + start.height)
  for (const box of [start, finish]) {
    expect(Math.abs(box.x - date.x)).toBeLessThan(1)
    expect(Math.abs(box.width - date.width)).toBeLessThan(1)
  }
  // the hint sits under the times
  const hint = (await sheet.getByText('Optional. Needed for Reminders hours before.').boundingBox())!
  expect(hint.y).toBeGreaterThanOrEqual(finish.y + finish.height)

  await expect(sheet.getByText('Choose a date')).toBeVisible()
  await expect(sheet.getByText('All day', { exact: true })).toBeVisible()
  // no Finish without a Start
  await expect(sheet.getByLabel('Finish time')).toBeDisabled()
  await expect(sheet.getByText('Set a Start time first')).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'All day' })).toBeHidden()

  await sheet.getByLabel('Event date').fill(await inDays(page, 3))
  await sheet.getByLabel('Start time').fill('09:30')
  await expect(sheet.getByLabel('Finish time')).toBeEnabled()
  await sheet.getByLabel('Finish time').fill('10:45')
  await sheet.getByLabel('Name').click()
  await expect(sheet.getByText('Choose a date')).toBeHidden()

  // "All day" takes both times away again
  await sheet.getByRole('button', { name: 'All day' }).click()
  await expect(sheet.getByLabel('Start time')).toHaveValue('')
  await expect(sheet.getByLabel('Finish time')).toHaveValue('')
  await expect(sheet.getByLabel('Finish time')).toBeDisabled()
})

test('a Finish time must be later than the Start time', async ({ page }) => {
  await logInAsNewPerson(page)
  await openAddSheet(page)
  const sheet = page.getByRole('dialog', { name: 'New Item' })
  await sheet.getByLabel('Name').fill('Dentist')
  await sheet.getByText('Health').click()
  await sheet.getByLabel('Event date').fill(await inDays(page, 3))
  await sheet.getByLabel('Start time').fill('10:00')
  await sheet.getByLabel('Finish time').fill('09:00')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet.getByRole('alert')).toHaveText('Finish time must be later than Start time.')

  await sheet.getByLabel('Finish time').fill('11:30')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('listitem').filter({ hasText: 'Dentist' })).toContainText('10:00 AM – 11:30 AM')
})

test('Category chips show line icons, muted until picked, then in the chip’s own colour', async ({ page }) => {
  await logInAsNewPerson(page)
  await openAddSheet(page)
  const chips = page.getByRole('group', { name: 'Category' })
  await expect(chips.locator('svg[data-category]')).toHaveCount(10)
  await expect(chips).not.toContainText(/\p{Extended_Pictographic}/u)

  const health = chips.locator('label').filter({ hasText: 'Health' })
  const colour = (l: import('@playwright/test').Locator) => l.evaluate((el) => getComputedStyle(el).color)
  const unpicked = await colour(health.locator('svg'))
  expect(unpicked).not.toBe(await colour(health))

  await health.click()
  expect(await colour(health.locator('svg'))).toBe(await colour(health))
})

test('Event wording: rows say Today, Tomorrow, In 5 days; nothing on screen says "Due"', async ({ page }) => {
  await logInAsNewPerson(page)
  for (const [name, days] of [
    ['Gym', 0],
    ['Dentist', 1],
    ['Rent', 5],
  ] as const) {
    await openAddSheet(page)
    const sheet = page.getByRole('dialog', { name: 'New Item' })
    await expect(sheet).not.toContainText(/\bdue\b/i)
    await sheet.getByLabel('Name').fill(name)
    await sheet.getByText('Other').click()
    await sheet.getByLabel('Event date').fill(await inDays(page, days))
    await sheet.getByRole('button', { name: 'Save' }).click()
    await expect(sheet).toBeHidden()
  }
  const row = (name: string) => page.getByRole('listitem').filter({ hasText: name })
  await expect(row('Gym')).toContainText(/^Gym\s*Today/)
  await expect(row('Dentist')).toContainText(/^Dentist\s*Tomorrow/)
  await expect(row('Rent')).toContainText(/^Rent\s*In 5 days/)
  await expect(page.locator('body')).not.toContainText(/\bdue\b/i)

  await row('Rent').getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Rent' })
  await expect(sheet.getByRole('button', { name: /^Event date/ })).toBeVisible()
  await expect(sheet).not.toContainText(/\bdue\b/i)
})

test('on a phone, New Item has a grab line; dragging it down closes, a short drag springs back', async ({
  page,
}, info) => {
  test.skip(info.project.name.startsWith('computer'), 'phone only')
  await logInAsNewPerson(page)
  // from the + button and from a double tap on a calendar day
  for (const open of ['button', 'calendar'] as const) {
    if (open === 'button') await openAddSheet(page)
    else {
      await page.getByRole('tab', { name: 'Calendar' }).click()
      const day = page.getByTestId('calendar-days').getByRole('button').nth(10)
      await day.tap()
      await day.tap()
    }
    const sheet = page.getByRole('dialog', { name: 'New Item' })
    await expect(sheet).toBeVisible()
    const handle = sheet.getByTestId('sheet-handle')
    await expect(handle).toBeVisible()
    const box = (await handle.boundingBox())!
    const sheetBox = (await sheet.boundingBox())!
    const x = box.x + box.width / 2

    await page.mouse.move(x, box.y + 2)
    await page.mouse.down()
    await page.mouse.move(x, box.y + 40, { steps: 10 })
    await page.mouse.up()
    await expect(sheet).toBeVisible()

    await page.mouse.move(x, box.y + 2)
    await page.mouse.down()
    await page.mouse.move(x, box.y + sheetBox.height * 0.7, { steps: 10 })
    await page.mouse.up()
    await expect(sheet).toBeHidden()
  }
})
