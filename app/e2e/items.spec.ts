import { expect, test } from '@playwright/test'
import { expectAccessible } from './axe'

test('a new person sees an empty Items screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Nothing to track yet.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Items' }).first()).toBeVisible()
  await expectAccessible(page)
})
