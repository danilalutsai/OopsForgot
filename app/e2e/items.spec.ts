import { expect, test } from '@playwright/test'
import { expectAccessible } from './axe'

test('a logged-out visitor is sent to log in', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expectAccessible(page)
})
