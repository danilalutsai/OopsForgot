import { expect, test } from '@playwright/test'
import { expectAccessible } from './axe'
import { logInAsNewPerson, openFromAvatar } from './people'

test('change the day Reminder time in Settings', async ({ page }) => {
  await logInAsNewPerson(page)
  await openFromAvatar(page, 'Settings')
  await expectAccessible(page)

  const line = page.getByRole('button', { name: /^Day Reminders at/ })
  await line.click()
  await page.getByLabel('Day Reminders at').fill('08:07')
  await page.getByLabel('Day Reminders at').blur()
  await expect(page.getByRole('status')).toHaveText('Saved')
  await expect(page.getByLabel('Day Reminders at')).toHaveValue('08:00')
  await page.getByLabel('Day Reminders at').fill('08:10')
  await page.getByLabel('Day Reminders at').blur()
  await expect(page.getByLabel('Day Reminders at')).toHaveValue('08:00')

  await page.getByRole('button', { name: 'Back to 12:00' }).click()
  await expect(page.getByLabel('Day Reminders at')).toHaveValue('12:00')
})

test('a device in another time zone gets an amber dot and an "Update time zone?" question', async ({ page }) => {
  await logInAsNewPerson(page, 'Ana', 'Tester', 'Pacific/Auckland')
  await expect(page.getByRole('button', { name: /Account menu/ }).getByTitle('Needs your attention')).toBeVisible()
  await openFromAvatar(page, 'Settings')
  await expect(page.getByRole('heading', { name: 'Update time zone?' })).toBeVisible()
  await page.getByRole('button', { name: 'Use new' }).click()
  await expect(page.getByRole('heading', { name: 'Update time zone?' })).toBeHidden()
  await expect(page.getByRole('button', { name: /^Time zone/ })).not.toContainText('Pacific/Auckland')
})

test('change currency and name; the avatar follows', async ({ page }) => {
  await logInAsNewPerson(page)
  await openFromAvatar(page, 'Settings')
  await page.getByRole('button', { name: /^Currency/ }).click()
  await expect(page.getByText('Existing amounts are not converted.')).toBeVisible()
  await page.getByLabel('Currency').selectOption('USD')
  await expect(page.getByRole('button', { name: /^Currency/ })).toContainText('USD')

  await openFromAvatar(page, 'Account')
  await page.getByRole('button', { name: /^Profile/ }).click()
  await expect(page.getByLabel('Surname')).toHaveValue('García López')
  await page.getByLabel('Name', { exact: true }).fill('Anna')
  await page.getByLabel('Name', { exact: true }).blur()
  await expect(page.getByRole('button', { name: /^Profile/ })).toContainText('Anna García López')
  await page.goto('/')
  await expect(page.getByText('Welcome, Anna')).toBeVisible()
  await expect(page.getByRole('button', { name: /Account/ })).toContainText('AG')
})

test('add and remove a profile photo', async ({ page }) => {
  await logInAsNewPerson(page)
  await openFromAvatar(page, 'Account')
  await page.getByRole('button', { name: /^Profile/ }).click()
  // any real image will do: a small screenshot of the page itself
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 60, height: 40 } })
  await page.getByLabel('Photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('status')).toHaveText('Saved')
  await expect(page.getByRole('button', { name: 'Change photo' })).toBeVisible()
  await expect(page.locator('img').first()).toHaveAttribute('src', /avatars/)

  await page.getByRole('button', { name: 'Remove photo' }).click()
  await expect(page.getByRole('button', { name: 'Add photo' })).toBeVisible()
  await expect(page.locator('img')).toHaveCount(0)
})

test('section titles stand out: main text colour, bold', async ({ page }) => {
  await logInAsNewPerson(page)
  await openFromAvatar(page, 'Settings')
  for (const name of ['Reminders', 'Calendar', 'Money', 'Privacy']) {
    const title = page.getByRole('heading', { name, exact: true })
    const look = await title.evaluate((el) => {
      const s = getComputedStyle(el)
      return { color: s.color, weight: Number(s.fontWeight), text: getComputedStyle(document.body).color }
    })
    expect(look.color, name).toBe(look.text)
    expect(look.weight, name).toBeGreaterThanOrEqual(700)
  }
})

for (const scheme of ['light', 'dark'] as const)
  test(`Settings and Account look like the opened Item sheet (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await logInAsNewPerson(page)
    const colours = () =>
      page.evaluate(() => {
        const root = getComputedStyle(document.documentElement)
        const probe = document.createElement('div')
        document.body.append(probe)
        const paint = (v: string) => (
          (probe.style.backgroundColor = root.getPropertyValue(v)),
          getComputedStyle(probe).backgroundColor
        )
        const result = { surface: paint('--c-surface'), dark: paint('--c-bg') }
        probe.remove()
        return result
      })
    for (const [name, line] of [
      ['Settings', /^Currency/],
      ['Account', /^Profile/],
    ] as const) {
      await openFromAvatar(page, name)
      const { surface, dark } = await colours()
      const heading = page.getByRole('heading', { name, level: 1 })
      // the page behind the header is the sheet's surface colour
      const pageColour = await heading.evaluate((el) => {
        for (let n: Element | null = el; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor
          if (c !== 'rgba(0, 0, 0, 0)') return c
        }
        return ''
      })
      expect(pageColour, name).toBe(surface)
      // an opened row is the darker block, as in the Item sheet
      const row = page.getByRole('button', { name: line })
      await row.click()
      await expect(row).toHaveAttribute('aria-expanded', 'true')
      expect(await row.evaluate((b) => getComputedStyle(b.parentElement!).backgroundColor), name).toBe(dark)
    }
  })
