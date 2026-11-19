import { expect, test, type Page } from '@playwright/test'
import { logInAsNewPerson, openFromAvatar } from './people'

const pageBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
/** Taps a theme choice the way a person does: on its visible label. */
async function pick(page: Page, name: string) {
  await page
    .locator('label')
    .filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) })
    .click()
  await expect(page.getByRole('radio', { name })).toBeChecked()
}
const LIGHT = 'rgb(248, 250, 252)'
const DARK = 'rgb(11, 16, 32)'

test('choose Light or Dark in Settings; it applies at once and stays after reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await logInAsNewPerson(page)
  expect(await pageBackground(page)).toBe(DARK)

  await openFromAvatar(page, 'Settings')
  await page.getByRole('button', { name: /^Theme/ }).click()
  await pick(page, 'Light')
  await expect.poll(() => pageBackground(page)).toBe(LIGHT)
  await expect(page.getByRole('button', { name: /^Theme/ })).toContainText('Light')

  // no flash of the device's dark theme while the app starts again
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
  expect(await pageBackground(page)).toBe(LIGHT)

  // the login screens follow the choice too
  await page.getByRole('button', { name: /Account menu/ }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login/)
  expect(await pageBackground(page)).toBe(LIGHT)
})

test('System follows the device, also when it switches while the app is open', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await logInAsNewPerson(page)
  await openFromAvatar(page, 'Settings')
  await page.getByRole('button', { name: /^Theme/ }).click()
  await pick(page, 'Dark')
  await expect.poll(() => pageBackground(page)).toBe(DARK)

  await pick(page, 'System')
  await expect.poll(() => pageBackground(page)).toBe(LIGHT)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect.poll(() => pageBackground(page)).toBe(DARK)
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined()
})
