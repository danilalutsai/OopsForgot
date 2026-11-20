import { expect, test } from '@playwright/test'
import { inDays, logInAsNewPerson } from './people'

test('offline, the saved copy shows read-only and changes wait for the internet', async ({ page, context }) => {
  await logInAsNewPerson(page)
  await page.getByRole('button', { name: 'Add Item' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill('Passport')
  await page.getByText('Documents').click()
  await page.getByLabel('Event date').fill(await inDays(page, 30))
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Passport' })).toBeVisible()
  // let the service worker take control and the saved copy be written
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await page.waitForTimeout(1500)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText(/^Offline, last updated/)).toBeVisible()
  const row = page.getByRole('listitem').filter({ hasText: 'Passport' })
  await expect(row).toContainText('In 30 days')

  await page.getByRole('button', { name: 'Mark Passport Handled' }).click()
  await expect(page.getByText('You’re offline. Changes can be made once you’re back online.')).toBeVisible()
  await expect(row).not.toContainText('Handled')

  await context.setOffline(false)
  await expect(page.getByText(/^Offline/)).toBeHidden()
})
