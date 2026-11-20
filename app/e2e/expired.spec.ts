import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './axe'
import { inDays, logInAsNewPerson } from './people'

async function addItem(page: Page, name: string, days: number, times?: [string, string]) {
  await page.getByRole('button', { name: 'Add Item' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill(name)
  await page.getByText('Documents').click()
  await page.getByLabel('Due date').fill(await inDays(page, days))
  if (times) {
    await page.getByLabel('Start time').fill(times[0])
    await page.getByLabel('Finish time').fill(times[1])
  }
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}
const expiredButton = (page: Page) => page.getByRole('button', { name: 'Expired', exact: true })
const expired = (page: Page) => page.getByRole('region', { name: 'Expired' })
const colour = (page: Page, token: string) =>
  page.evaluate((t) => {
    const probe = document.createElement('span')
    probe.style.color = `var(${t})`
    document.body.append(probe)
    const c = getComputedStyle(probe).color
    probe.remove()
    return c
  }, token)

test('Expired Items wait above Today, hidden until "↑ Expired"; oldest first, all in grey', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Visa', -2)
  await addItem(page, 'Old ID', -5)
  await addItem(page, 'Gym card', 0)
  await addItem(page, 'Insurance', 20)

  // the list opens at Today: Expired is hidden, the button sits next to the TODAY header
  await expect(expired(page)).toBeHidden()
  const today = page.getByRole('region', { name: 'Today' })
  await expect(today.getByRole('listitem')).toHaveCount(1)
  await expect(today.getByText('Gym card')).toBeVisible()
  const button = expiredButton(page)
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  const header = (await page.getByRole('heading', { name: 'Today' }).boundingBox())!
  const at = (await button.boundingBox())!
  expect(Math.abs(at.y + at.height / 2 - (header.y + header.height / 2))).toBeLessThan(12)
  // neutral, not red
  expect(await button.evaluate((b) => getComputedStyle(b).color)).toBe(await colour(page, '--c-muted'))

  await button.click()
  await expect(expired(page)).toBeVisible()
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  // oldest at the top, the most recent right above Today
  await expect(expired(page).getByRole('listitem')).toHaveText([/Old ID/, /Visa/])
  const list = (await expired(page).boundingBox())!
  expect(list.y + list.height).toBeLessThanOrEqual(header.y + 400)
  expect(list.y + list.height).toBeLessThanOrEqual(
    (await page.getByRole('heading', { name: 'Today' }).boundingBox())!.y,
  )
  // grey: bar, countdown and icon; not red
  const visa = expired(page).getByRole('listitem').filter({ hasText: 'Visa' })
  await expect(visa).toContainText('Expired 2 days ago')
  const muted = await colour(page, '--c-muted')
  expect(await visa.getByText('Expired 2 days ago').evaluate((e) => getComputedStyle(e).color)).toBe(muted)
  expect(await visa.locator('svg[data-category]').evaluate((e) => getComputedStyle(e).color)).toBe(muted)
  expect(await visa.getByTestId('urgency-bar').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
    await page.evaluate(() => {
      const probe = document.createElement('span')
      probe.className = 'bg-urgent-grey'
      document.body.append(probe)
      const c = getComputedStyle(probe).backgroundColor
      probe.remove()
      return c
    }),
  )
  await expectAccessible(page)

  // tapping again hides it
  await button.click()
  await expect(expired(page)).toBeHidden()
})

test('no Expired Items: no "Expired" button', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Gym card', 0)
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(expiredButton(page)).toHaveCount(0)
})

test('an Item with a Finish time is Expired right after it, on the same day', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Early call', 0, ['00:00', '00:01'])
  await addItem(page, 'Late call', 0, ['23:58', '23:59'])
  await expect(page.getByRole('region', { name: 'Today' }).getByText('Late call')).toBeVisible()
  await expiredButton(page).click()
  await expect(expired(page).getByText('Early call')).toBeVisible()
})

test('computer: scrolling up past the top of the list shows Expired', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('computer'), 'mouse wheel')
  await logInAsNewPerson(page)
  await addItem(page, 'Visa', -2)
  await addItem(page, 'Gym card', 0)
  await expect(expired(page)).toBeHidden()
  await page.getByRole('heading', { name: 'Today' }).hover()
  await page.mouse.wheel(0, -400)
  await expect(expired(page)).toBeVisible()
})

test('phone: pulling down at the top of the list shows Expired', async ({ page }, info) => {
  // WebKit here has no Touch constructor to fake a finger with; check it on a real iPhone
  test.skip(info.project.name !== 'phone-chromium', 'synthetic touch only in Chromium')
  await logInAsNewPerson(page)
  await addItem(page, 'Visa', -2)
  await addItem(page, 'Gym card', 0)
  await expect(expired(page)).toBeHidden()
  // a finger dragging the page down while it is already at the top
  await page.getByRole('heading', { name: 'Today' }).evaluate((el) => {
    const touch = (y: number) => new Touch({ identifier: 1, target: el, clientX: 150, clientY: y })
    const send = (type: string, y: number) =>
      el.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: type === 'touchend' ? [] : [touch(y)],
          changedTouches: [touch(y)],
        }),
      )
    send('touchstart', 200)
    for (let y = 210; y <= 330; y += 10) send('touchmove', y)
    send('touchend', 330)
  })
  await expect(expired(page)).toBeVisible()
})

test('calendar: Expired Items still show on their day, in grey', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Visa', -1)
  await page.getByRole('tab', { name: 'Calendar' }).click()
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await page.getByRole('button', { name: 'Month', exact: true }).click()
  const label = await page.evaluate(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toLocaleDateString(navigator.language, { day: 'numeric', month: 'long' })
  })
  const day = page.getByRole('button', { name: `${label}, 1 Item` })
  await expect(day.locator('span span').first()).toHaveClass(/bg-urgent-grey/)
  await day.click()
  const visa = page.getByRole('listitem').filter({ hasText: 'Visa' })
  await expect(visa.getByTestId('urgency-bar')).toHaveClass(/bg-urgent-grey/)
})

test('Settings: choose how long Expired Items stay', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.goto('/settings')
  const line = page.getByRole('button', { name: /^Delete Expired Items after/ })
  await expect(line).toContainText('1 month')
  await line.click()
  await page
    .locator('label')
    .filter({ hasText: /^\s*1 week\s*$/ })
    .click()
  await expect(page.getByRole('radio', { name: '1 week' })).toBeChecked()
  await expect(line).toContainText('1 week')
  await page.reload()
  await expect(page.getByRole('button', { name: /^Delete Expired Items after/ })).toContainText('1 week')
})
