import { expect, test } from '@playwright/test'
import { expectAccessible } from './axe'
import { logInAsNewPerson, openFromAvatar } from './people'

test('set up, reset and turn off the Calendar feed', async ({ page }) => {
  await logInAsNewPerson(page)
  await openFromAvatar(page, 'Settings')
  const line = page.getByRole('button', { name: /^Calendar feed/ })
  await expect(line).toContainText('Off')
  await line.click()
  await page.getByRole('button', { name: 'Set up Calendar feed' }).click()

  const link = page.getByLabel('Your Calendar feed link')
  await expect(link).toHaveValue(/\/functions\/v1\/calendar-feed\?token=[0-9a-f]{48}$/)
  await expect(page.getByText('Don’t share it.')).toBeVisible()
  await expectAccessible(page)
  const first = await link.inputValue()
  const feed = await page.request.get(first)
  expect(feed.status()).toBe(200)

  await page.getByRole('button', { name: 'Reset link' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset link' }).click()
  await expect(link).not.toHaveValue(first)
  expect((await page.request.get(first)).status()).toBe(404)

  await page.getByRole('button', { name: 'Turn off' }).click()
  await expect(line).toContainText('Off')
  await expect(page.getByRole('button', { name: 'Set up Calendar feed' })).toBeVisible()
})
