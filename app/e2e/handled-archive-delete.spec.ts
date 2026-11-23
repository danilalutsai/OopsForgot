import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './axe'
import { inDays, logInAsNewPerson, pick } from './people'

async function addItem(page: Page, name: string, days: number) {
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill(name)
  await page.getByText('Other').click()
  await pick(page.getByLabel('Event date'), await inDays(page, days))
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

const row = (page: Page, name: string) => page.getByRole('listitem').filter({ hasText: name })

async function swipe(page: Page, name: string, dx: number) {
  const box = (await row(page, name).boundingBox())!
  const y = box.y + box.height / 2
  const x = box.x + box.width / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y, { steps: 12 })
  await page.mouse.up()
}

test('mark an Event Handled in place, then undo it', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Netflix', 2)
  await page.getByRole('button', { name: 'Mark Netflix Handled' }).click()
  await expect(row(page, 'Netflix')).toContainText('Handled')
  await expect(page.getByRole('region', { name: 'This week' }).getByText('Netflix')).toBeVisible()
  await expectAccessible(page)

  // the message sits on a raised card in the app's colours, Undo is an outlined button
  const toast = page.getByRole('status')
  await expect(toast).toHaveText(/^Marked as Handled\s*Undo$/)
  const look = await toast.getByRole('button', { name: 'Undo' }).evaluate((undo) => {
    const card = getComputedStyle(undo.parentElement!)
    const body = getComputedStyle(document.body)
    return {
      cardText: card.color,
      bodyText: body.color,
      undoBorder: parseFloat(getComputedStyle(undo).borderTopWidth),
      underline: getComputedStyle(undo).textDecorationLine,
    }
  })
  expect(look.cardText).toBe(look.bodyText)
  expect(look.undoBorder).toBeGreaterThan(0)
  expect(look.underline).toBe('none')

  await toast.getByRole('button', { name: 'Undo' }).click()
  await expect(row(page, 'Netflix')).toContainText('In 2 days')
})

test('swipe right for Handled; swipe left deletes, in red, with Undo', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Gym', 3)
  await swipe(page, 'Gym', 150)
  await expect(page.getByRole('button', { name: 'Undo Handled for Gym' })).toBeVisible()

  // what letting go will do shows under the row while swiping: Delete, on red
  const box = (await row(page, 'Gym').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2, { steps: 6 })
  const under = row(page, 'Gym').getByText('Delete', { exact: true })
  await expect(under).toBeVisible()
  // the strip under the row is the app's red
  expect(await under.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    await page.evaluate(() => {
      const probe = document.createElement('span')
      probe.className = 'bg-urgent-red'
      document.body.append(probe)
      const c = getComputedStyle(probe).backgroundColor
      probe.remove()
      return c
    }),
  )
  await page.mouse.move(box.x + box.width / 2 - 150, box.y + box.height / 2, { steps: 6 })
  await page.mouse.up()

  await expect(page.getByRole('status')).toContainText('Gym deleted')
  await expect(row(page, 'Gym')).toHaveCount(0)
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('region', { name: 'This week' }).getByText('Gym')).toBeVisible()
  // there is no Archived any more
  await expect(page.getByText(/Archived/)).toHaveCount(0)
})

test('delete an Event from its sheet after confirming, and undo it', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Old card', 40)
  await page
    .getByRole('button', { name: /Old card/ })
    .first()
    .click()
  await page.getByRole('dialog', { name: 'Old card' }).getByRole('button', { name: 'Delete' }).click()
  const ask = page.getByRole('alertdialog', { name: 'Delete Old card?' })
  await expect(ask).toContainText('Gone for good.')
  await ask.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('status')).toContainText('Old card deleted')
  await expect(row(page, 'Old card')).toHaveCount(0)

  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(row(page, 'Old card')).toBeVisible()
})

test('a Handled repeating Event reminds again for its next Event date', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill('Cleaning')
  await page.getByText('Home').click()
  await pick(page.getByLabel('Event date'), await inDays(page, -7))
  await page.getByRole('combobox', { name: 'Repeats' }).selectOption({ label: 'Every week' })
  await page.getByRole('button', { name: 'Save' }).click()
  // Handled for last week's Event date does not carry over to today's
  await expect(row(page, 'Cleaning')).toContainText(/^Cleaning\s*Today/)
  await page.getByRole('button', { name: 'Mark Cleaning Handled' }).click()
  await expect(row(page, 'Cleaning')).toContainText('Handled')
})

test('Delete waits until sheet changes are saved or discarded; there is no Archive', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Passport', 90)
  await row(page, 'Passport').getByRole('button').first().click()
  const sheet = page.getByRole('dialog', { name: 'Passport' })
  await sheet.getByRole('button', { name: 'Change Name' }).click()
  await sheet.getByLabel('Name', { exact: true }).fill('Passport (renew)')
  await expect(sheet.getByRole('button', { name: 'Archive' })).toHaveCount(0)
  await expect(sheet.getByRole('button', { name: 'Delete' })).toBeDisabled()
  await expect(sheet.getByText('Save or discard your changes before deleting.')).toBeVisible()
})

test('tapping ✓ twice quickly ends up not Handled', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Spotify', 4)
  await page.getByRole('button', { name: 'Mark Spotify Handled' }).click()
  await page.getByRole('button', { name: 'Undo Handled for Spotify' }).click()
  await expect(row(page, 'Spotify')).toContainText('In 4 days')
  await page.reload()
  await expect(row(page, 'Spotify')).toContainText('In 4 days')
})
