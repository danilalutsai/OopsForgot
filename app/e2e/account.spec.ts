import { expect, test } from '@playwright/test'
import { expectAccessible } from './axe'
import { logInAsNewPerson, openFromAvatar } from './people'

test('the avatar menu has Account, Settings and Log out; the top bar has no gear', async ({ page }) => {
  await logInAsNewPerson(page)
  await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(0)
  await page.getByRole('button', { name: /Account menu/ }).click()
  await expect(page.getByRole('menuitem')).toHaveText(['Account', 'Settings', 'Log out'])
  await page.keyboard.press('Escape')

  await openFromAvatar(page, 'Account')
  await expect(page).toHaveURL(/\/account$/)
  await expectAccessible(page)
  for (const line of [/^Profile/, /^Email/, /^Password/, /^Google/])
    await expect(page.getByRole('button', { name: line })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log out everywhere' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete account' })).toBeVisible()

  await openFromAvatar(page, 'Settings')
  await expect(page.getByRole('button', { name: /^Profile/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete account' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toHaveCount(0)

  await page
    .getByRole('navigation', { name: 'Main' })
    .filter({ visible: true })
    .getByRole('link', { name: 'Items' })
    .click()
  await page.getByRole('button', { name: /Account menu/ }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login/)
})

test('something needing attention shows as a dot on the avatar', async ({ page }) => {
  await logInAsNewPerson(page, 'Ana', 'Tester', 'Pacific/Auckland')
  await expect(page.getByRole('button', { name: /Account menu/ }).getByTitle('Needs your attention')).toBeVisible()
})
