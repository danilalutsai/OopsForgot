import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './axe'
import { choose, inDays, logInAsNewPerson, pick } from './people'

async function addGym(page: Page) {
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill('Gym')
  await page.getByText('Health').click()
  await pick(page.getByLabel('Event date'), await inDays(page, 10))
  await page.getByLabel('Price').fill('35')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

test('change an Event line by line; Save saves and closes the sheet', async ({ page }) => {
  await logInAsNewPerson(page)
  await addGym(page)
  await page.getByRole('listitem').filter({ hasText: 'Gym' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Gym' })
  await expect(sheet.locator('header').getByRole('status')).toHaveText('All changes saved')
  await expectAccessible(page)

  await sheet.getByRole('button', { name: /^Price/ }).click()
  await sheet.getByLabel('Price').fill('39.90')
  await sheet.getByRole('button', { name: /^Event date/ }).click()
  await pick(sheet.getByLabel('Event date'), await inDays(page, 2))
  await expect(sheet.locator('header').getByRole('status')).toHaveText('Unsaved changes')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  const row = page.getByRole('region', { name: 'This week' }).getByRole('listitem').filter({ hasText: 'Gym' })
  await expect(row).toContainText('€39.90')
  await expect(row).toContainText('In 2 days')
})

test('closing with unsaved changes asks first; Discard keeps the old values', async ({ page }) => {
  await logInAsNewPerson(page)
  await addGym(page)
  await page.getByRole('listitem').filter({ hasText: 'Gym' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Gym' })
  await sheet.getByRole('button', { name: 'Change Name' }).click()
  await sheet.getByLabel('Name', { exact: true }).fill('Gym and pool')

  await sheet.getByRole('button', { name: 'Close' }).filter({ visible: true }).click()
  const ask = page.getByRole('alertdialog', { name: 'Save your changes?' })
  await ask.getByRole('button', { name: 'Keep editing' }).click()
  await expect(sheet.getByLabel('Name', { exact: true })).toHaveValue('Gym and pool')

  await sheet.getByRole('button', { name: 'Close' }).filter({ visible: true }).click()
  await ask.getByRole('button', { name: 'Discard' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('listitem').filter({ hasText: 'Gym' })).not.toContainText('pool')
})

test('Save in the leave question saves, then closes', async ({ page }) => {
  await logInAsNewPerson(page)
  await addGym(page)
  await page.getByRole('listitem').filter({ hasText: 'Gym' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Gym' })
  await sheet.getByRole('button', { name: /^Category/ }).click()
  await sheet.getByText('Home').click()
  await expect(sheet.getByRole('button', { name: /^Category/ })).toContainText('Home')
  await expect(sheet.getByRole('button', { name: /^Category/ }).locator('svg[data-category="home"]')).toBeVisible()
  await sheet.getByRole('button', { name: 'Close' }).filter({ visible: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  const row = page.getByRole('listitem').filter({ hasText: 'Gym' })
  // a line icon, not an emoji
  await expect(row.locator('svg[data-category="home"]')).toBeVisible()
  await expect(row).not.toContainText('🏠')
})

test('on a phone, dragging the top bar down closes the sheet; a short drag springs back', async ({ page }, info) => {
  test.skip(info.project.name.startsWith('computer'), 'phone only')
  await logInAsNewPerson(page)
  await addGym(page)
  await page.getByRole('listitem').filter({ hasText: 'Gym' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Gym' })
  const bar = sheet.locator('header').getByRole('status')
  const box = (await bar.boundingBox())!
  const sheetBox = (await sheet.boundingBox())!

  await page.mouse.move(box.x + box.width / 2, box.y + 5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + 40, { steps: 10 })
  await page.mouse.up()
  await expect(sheet).toBeVisible()

  await page.mouse.move(box.x + box.width / 2, box.y + 5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + sheetBox.height * 0.7, { steps: 10 })
  await page.mouse.up()
  await expect(sheet).toBeHidden()
})

test('tapping outside with unsaved changes asks before leaving', async ({ page }) => {
  await logInAsNewPerson(page)
  await addGym(page)
  await page.getByRole('listitem').filter({ hasText: 'Gym' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Gym' })
  await sheet.getByRole('button', { name: /^Price/ }).click()
  await sheet.getByLabel('Price').fill('40')
  await page.mouse.click(5, 5)
  await expect(page.getByRole('alertdialog', { name: 'Save your changes?' })).toBeVisible()
})

test('an unfinished custom repeat is never saved as "doesn\'t repeat"', async ({ page }) => {
  await logInAsNewPerson(page)
  await addGym(page)
  await page.getByRole('listitem').filter({ hasText: 'Gym' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Gym' })
  await sheet.getByRole('button', { name: /^Repeats/ }).click()
  await choose(sheet.getByRole('combobox', { name: 'Repeats' }), 'Custom…')
  await sheet.getByLabel('Every', { exact: true }).fill('0')
  await sheet.getByRole('button', { name: /^Repeats/ }).click()
  await expect(sheet.getByRole('button', { name: /^Repeats/ })).toContainText('Custom: type how often')
  await sheet.getByRole('button', { name: /^Repeats/ }).click()
  await expect(sheet.getByRole('combobox', { name: 'Repeats' })).toHaveText('Custom…')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet.getByRole('alert')).toContainText('Repeat every 1 to 365.')
})

test('a push Reminder link (/?item=<id>) opens that Event', async ({ page }) => {
  await logInAsNewPerson(page)
  await addGym(page)
  // the Item's id, read with the person's own session the way the app reads it
  const id = await page.evaluate(async () => {
    const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'))!
    const { access_token } = JSON.parse(localStorage.getItem(key)!)
    const res = await fetch('http://127.0.0.1:54321/rest/v1/items?select=id&name=eq.Gym', {
      headers: { apikey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH', Authorization: `Bearer ${access_token}` },
    })
    return ((await res.json()) as { id: string }[])[0]!.id
  })
  await page.goto(`/?item=${id}`)
  await expect(page.getByRole('dialog', { name: 'Gym' })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
})

test('a Reminder link opened while logged out opens its Event after logging in', async ({ page }) => {
  const person = await logInAsNewPerson(page)
  await addGym(page)
  const id = await page.evaluate(async () => {
    const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'))!
    const { access_token } = JSON.parse(localStorage.getItem(key)!)
    const res = await fetch('http://127.0.0.1:54321/rest/v1/items?select=id&name=eq.Gym', {
      headers: { apikey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH', Authorization: `Bearer ${access_token}` },
    })
    return ((await res.json()) as { id: string }[])[0]!.id
  })
  await page.getByRole('button', { name: /Account/ }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await page.goto(`/?item=${id}`)
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await page.getByLabel('Email').fill(person.email)
  await page.getByLabel('Password').fill(person.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('dialog', { name: 'Gym' })).toBeVisible()
})

test('an opened line and its editor share one darker block', async ({ page }) => {
  await logInAsNewPerson(page)
  await addGym(page)
  await page.getByRole('listitem').filter({ hasText: 'Gym' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Gym' })
  const line = sheet.getByRole('button', { name: /^Notes/ })
  await line.click()
  await expect(line).toHaveAttribute('aria-expanded', 'true')
  await expect(sheet.getByLabel('Notes')).toBeVisible()

  const look = await line.evaluate((button) => {
    const block = button.parentElement!
    const editor = block.lastElementChild!
    const page = getComputedStyle(document.body).backgroundColor
    return {
      block: getComputedStyle(block).backgroundColor,
      page,
      editorInside: block.contains(editor) && editor !== button,
      editorBottom: editor.getBoundingClientRect().bottom,
      blockBottom: block.getBoundingClientRect().bottom,
    }
  })
  expect(look.block).toBe(look.page)
  expect(look.editorInside).toBe(true)
  expect(look.blockBottom).toBeGreaterThanOrEqual(look.editorBottom)

  // a closed line has no block
  await line.click()
  await expect(line).toHaveAttribute('aria-expanded', 'false')
  await expect
    .poll(() => line.evaluate((b) => getComputedStyle(b.parentElement!).backgroundColor))
    .toBe('rgba(0, 0, 0, 0)')
})

test('the Time row of an all-day Event says so, also when opened; Start and Finish show as a range', async ({
  page,
}) => {
  await logInAsNewPerson(page)
  await addGym(page)
  await page.getByRole('listitem').filter({ hasText: 'Gym' }).getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Gym' })
  const line = sheet.getByRole('button', { name: /^Time/ })
  await expect(line).toContainText('All day')
  await line.click()
  await expect(sheet.getByLabel(/^Start time/)).toHaveAttribute('data-value', '')
  await expect(sheet.getByLabel(/^Start time/).locator('..')).toContainText('All day')

  const reopen = () => page.getByRole('listitem').filter({ hasText: 'Gym' }).getByRole('button').first().click()
  await pick(sheet.getByLabel(/^Start time/), '18:00')
  await pick(sheet.getByLabel('Finish time'), '19:30')
  await sheet.locator('header').getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  await reopen()
  await expect(line).toContainText('18:00 – 19:30')

  // a Finish that is not after Start is refused: nothing is saved and the sheet stays open
  await line.click()
  await pick(sheet.getByLabel('Finish time'), '17:00')
  await sheet.locator('header').getByRole('button', { name: 'Save' }).click()
  await expect(sheet.getByRole('alert')).toContainText('Finish time must be later than Start time.')
  await expect(sheet).toBeVisible()

  await sheet.getByRole('button', { name: 'All day', exact: true }).click()
  await sheet.locator('header').getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  await reopen()
  await expect(line).toContainText('All day')
})
