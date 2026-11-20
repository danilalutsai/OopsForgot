import { expect, test, type Locator, type Page } from '@playwright/test'
import { inDays, logInAsNewPerson } from './people'

// iOS Safari gives date and time inputs a minimum width of their own, which pushed them (and the
// open row around them) past the right edge of the sheet. Playwright's WebKit is close to, not the
// same as, iOS Safari: confirm on a real iPhone too.
test.beforeEach(({}, info) => test.skip(info.project.name !== 'phone-webkit', 'iPhone layout'))

/** Neither the field nor its surroundings stick out of the sheet, and the page has no sideways scroll. */
async function expectFits(page: Page, sheet: Locator, field: Locator, block?: Locator) {
  const edge = (await sheet.boundingBox())!
  const right = edge.x + edge.width + 0.5
  for (const part of [field, block].filter(Boolean) as Locator[]) {
    const box = (await part.boundingBox())!
    expect(box.x + box.width, await part.evaluate((el) => el.outerHTML.slice(0, 80))).toBeLessThanOrEqual(right)
  }
  // what keeps real iOS Safari from widening the field: it drops its own look and minimum width
  const style = await field.evaluate((el) => {
    const s = getComputedStyle(el)
    return { appearance: s.webkitAppearance || s.appearance, minWidth: s.minWidth, boxSizing: s.boxSizing }
  })
  expect(style).toEqual({ appearance: 'none', minWidth: '0px', boxSizing: 'border-box' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)
  expect(await sheet.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
}

test('Event sheet: the open Event date and Time rows fit the sheet', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill('Passport')
  await page.getByText('Other').click()
  await page.getByLabel('Event date').fill(await inDays(page, 30))
  await page.getByLabel('Start time').fill('09:30')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.getByRole('listitem').filter({ hasText: 'Passport' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Passport' })
  for (const [name, fields] of [
    ['Event date', ['Event date']],
    ['Time', ['Start time', 'Finish time']],
  ] as const) {
    const line = sheet.getByRole('button', { name: new RegExp(`^${name}`) })
    await line.click()
    for (const label of fields) {
      const field = sheet.getByLabel(label, { exact: true })
      await expect(field).toBeVisible()
      await expectFits(page, sheet, field, line.locator('..'))
    }
  }
})

test('New Event sheet: the Event date, Start and Finish time fields fit', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  const sheet = page.getByRole('dialog')
  for (const value of ['', 'filled']) {
    if (value) {
      await page.getByLabel('Event date').fill(await inDays(page, 30))
      await page.getByLabel('Start time').fill('09:30')
    }
    await expectFits(page, sheet, page.getByLabel('Event date'))
    await expectFits(page, sheet, page.getByLabel('Start time'))
    await expectFits(page, sheet, page.getByLabel('Finish time'))
  }
})

test('Expense sheet: the date field fits', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('link', { name: 'Money' }).filter({ visible: true }).click()
  await page.getByRole('button', { name: 'Add Expense' }).first().click()
  const sheet = page.getByRole('dialog')
  await expectFits(page, sheet, sheet.getByLabel('Date'))
})
