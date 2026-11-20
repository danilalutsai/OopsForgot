import { expect, test } from '@playwright/test'
import { expectAccessible } from './axe'
import { inDays, logInAsNewPerson } from './people'

test('pick Reminders when adding an Event; only fitting ones are offered', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  const form = page.getByRole('dialog', { name: 'New Event' })
  const chip = (name: string) =>
    form.getByRole('group', { name: 'Reminders' }).getByRole('button', { name, exact: true })

  await expect(chip('1 day')).toHaveAttribute('aria-pressed', 'true')
  await expect(chip('1 hour')).toBeDisabled()
  await expect(form.getByText('Hour Reminders need a time.')).toBeVisible()
  await expect(form.getByText('Day Reminders arrive at')).toBeVisible()

  await form.getByLabel('Name').fill('Dentist')
  await form.getByText('Health').click()
  await form.getByLabel('Event date').fill(await inDays(page, 30))
  await form.getByLabel('Start time').fill('09:30')
  await expect(chip('1 hour')).toBeEnabled()
  await chip('1 hour').click()
  await chip('1 week').click()
  await expectAccessible(page)
  await form.getByRole('button', { name: 'Save' }).click()

  await page.getByRole('listitem').filter({ hasText: 'Dentist' }).getByRole('button').first().click()
  await expect(page.getByRole('dialog', { name: 'Dentist' }).getByRole('button', { name: /^Reminders/ })).toContainText(
    '1 hour before, 1 day before, 1 week before',
  )
})

test('an Event with a Start time tomorrow can have "1 day": it arrives at the Start time today', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  const form = page.getByRole('dialog', { name: 'New Event' })
  const chip = (name: string) =>
    form.getByRole('group', { name: 'Reminders' }).getByRole('button', { name, exact: true })
  await form.getByLabel('Event date').fill(await inDays(page, 1))
  // late enough that "today at the Start time" is still ahead, whatever the clock says now
  await form.getByLabel('Start time').fill('23:59')
  await expect(chip('1 day')).toBeEnabled()
  await expect(chip('2 days')).toBeDisabled()
  await expect(form.getByText('Day Reminders arrive at the Start time, 23:59.')).toBeVisible()
})

test('a weekly Event cannot have Reminders a week or more before', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  const form = page.getByRole('dialog', { name: 'New Event' })
  await form.getByLabel('Event date').fill(await inDays(page, 3))
  await form.getByRole('combobox', { name: 'Repeats' }).selectOption({ label: 'Every week' })
  const group = form.getByRole('group', { name: 'Reminders' })
  await expect(group.getByRole('button', { name: '2 days', exact: true })).toBeEnabled()
  await expect(group.getByRole('button', { name: '1 week', exact: true })).toBeDisabled()
  await expect(form.getByText('Some are longer than one repeat.')).toBeVisible()
})

test('change Reminders in the sheet; ones that no longer fit are dropped on save', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  const form = page.getByRole('dialog', { name: 'New Event' })
  await form.getByLabel('Name').fill('Flight')
  await form.getByText('Travel').click()
  await form.getByLabel('Event date').fill(await inDays(page, 20))
  await form.getByLabel('Start time').fill('07:00')
  await form.getByRole('group', { name: 'Reminders' }).getByRole('button', { name: '4 hours', exact: true }).click()
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toBeHidden()

  await page.getByRole('listitem').filter({ hasText: 'Flight' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Flight' })
  await sheet.getByRole('button', { name: /^Time/ }).click()
  await sheet.getByRole('button', { name: 'All day' }).click()
  await sheet.locator('header').getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  await page.getByRole('listitem').filter({ hasText: 'Flight' }).getByRole('button').first().click()
  await expect(sheet.getByRole('button', { name: /^Reminders/ })).toContainText('1 day before')
  await expect(sheet.getByRole('button', { name: /^Reminders/ })).not.toContainText('4 hours')
})

test('"Make it repeat" keeps only Reminders that fit the new repeat', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  const form = page.getByRole('dialog', { name: 'New Event' })
  await form.getByLabel('Name').fill('Bins')
  await form.getByText('Home').click()
  await form.getByLabel('Event date').fill(await inDays(page, 30))
  await form.getByRole('group', { name: 'Reminders' }).getByRole('button', { name: '2 weeks', exact: true }).click()
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toBeHidden()

  // move it into the past through the sheet, then answer "What now?" with weekly
  await page.getByRole('listitem').filter({ hasText: 'Bins' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Bins' })
  await sheet.getByRole('button', { name: /^Event date/ }).click()
  await sheet.getByLabel('Event date').fill(await inDays(page, -2))
  await sheet.locator('header').getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  // now Expired: it waits above Today
  await page.getByRole('button', { name: 'Expired', exact: true }).click()
  await page.getByRole('listitem').filter({ hasText: 'Bins' }).getByRole('button').first().click()
  await expect(sheet.getByRole('button', { name: /^Reminders/ })).toContainText('1 day before, 2 weeks before')
  await sheet.getByLabel('Repeat', { exact: true }).selectOption({ label: 'Every week' })
  await sheet.getByRole('button', { name: 'Make it repeat' }).click()
  await expect(sheet.getByRole('button', { name: /^Reminders/ })).toHaveText(/1 day before$/)
})

test('three quick taps on ✓ end up Handled', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill('Phone bill')
  await page.getByText('Other').click()
  await page.getByLabel('Event date').fill(await inDays(page, 5))
  await page.getByRole('button', { name: 'Save' }).click()
  const tick = page.getByRole('listitem').filter({ hasText: 'Phone bill' }).getByRole('button').nth(1)
  // the three saves go out one after another; reload only once all have reached the server
  let saved = 0
  const allSaved = new Promise<void>((done) =>
    page.on('response', (r) => {
      if (r.request().method() === 'PATCH' && r.url().includes('/rest/v1/items') && ++saved === 3) done()
    }),
  )
  await tick.click()
  await tick.click()
  await tick.click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Phone bill' })).toContainText('Handled')
  await allSaved
  await page.reload()
  await expect(page.getByRole('listitem').filter({ hasText: 'Phone bill' })).toContainText('Handled')
})
