import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './axe'
import { inDays, logInAsNewPerson } from './people'

async function addItem(page: Page, name: string, days: number, repeat?: string) {
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill(name)
  await page.getByText('Other').click()
  await page.getByLabel('Event date').fill(await inDays(page, days))
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

test('the calendar shows Events on their Event dates; tapping a day lists them', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Netflix', 0)
  await addItem(page, 'Cleaning', 0, 'Every week')
  await page.getByRole('tab', { name: 'Calendar' }).click()

  await expect(page.getByRole('button', { name: `${await dayName(page, 0)}, 2 Events` })).toBeVisible()
  await expect(page.getByRole('button', { name: `${await dayName(page, 7)}, 1 Event` })).toBeVisible()
  await expectAccessible(page)

  await page.getByRole('button', { name: `${await dayName(page, 7)}, 1 Event` }).click()
  const list = page.getByRole('region', { name: new RegExp(await dayName(page, 7)) })
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(list.getByText('Cleaning')).toBeVisible()
  await expect(list.getByText('In 7 days')).toBeVisible()
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

test('Handled is offered only for the Event date an Event is on now', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Cleaning', 0, 'Every week')
  await page.getByRole('tab', { name: 'Calendar' }).click()
  await page.getByRole('button', { name: 'Mark Cleaning Handled' }).click()
  await page.getByRole('button', { name: `${await dayName(page, 7)}, 1 Event` }).click()
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

for (const view of ['Week', 'Month'] as const)
  test(`${view.toLowerCase()} view: double-tap a day to add an Event on it; one tap only selects`, async ({
    page,
  }, info) => {
    await logInAsNewPerson(page)
    await page.getByRole('tab', { name: 'Calendar' }).click()
    // a neighbour of today in the same week, so it shows in both views
    await page.getByRole('button', { name: 'Week', exact: true }).click()
    const todayAt = await page
      .getByTestId('calendar-days')
      .getByRole('button')
      .evaluateAll((cells) => cells.findIndex((c) => c.getAttribute('aria-pressed') === 'true'))
    const offset = todayAt < 6 ? 1 : -1
    await page.getByRole('button', { name: view, exact: true }).click()
    const day = page.getByRole('button', { name: `${await dayName(page, offset)}, no Events` })
    const touch = !info.project.name.startsWith('computer')
    const tap = () => (touch ? day.tap() : day.click())

    // one tap selects the day and opens nothing
    await tap()
    await expect(day).toHaveAttribute('aria-pressed', 'true')
    await page.waitForTimeout(500)
    await expect(page.getByRole('dialog')).toBeHidden()

    // a double tap opens New Item on that date, with no time
    if (touch) {
      await day.tap()
      await day.tap()
    } else await day.dblclick()
    const sheet = page.getByRole('dialog', { name: 'New Event' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByLabel('Event date')).toHaveValue(await inDays(page, offset))
    await expect(sheet.getByLabel('Start time')).toHaveValue('')
    await expect(sheet.getByLabel('Finish time')).toHaveValue('')

    await sheet.getByLabel('Name').fill('Dentist')
    await sheet.getByText('Health').click()
    await sheet.getByRole('button', { name: 'Save' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('button', { name: `${await dayName(page, offset)}, 1 Event` })).toBeVisible()
  })

test('on a phone, a double tap on the calendar cannot zoom the page', async ({ page }, info) => {
  test.skip(info.project.name.startsWith('computer'), 'phone only')
  await logInAsNewPerson(page)
  await page.getByRole('tab', { name: 'Calendar' }).click()
  // pan-y or manipulation: the browser keeps scrolling but drops double-tap zoom
  const touchAction = await page
    .getByTestId('calendar-days')
    .getByRole('button')
    .first()
    .evaluate((el) => getComputedStyle(el.closest('[data-testid="calendar-days"]')!).touchAction)
  expect(['pan-y', 'manipulation']).toContain(touchAction)
})
