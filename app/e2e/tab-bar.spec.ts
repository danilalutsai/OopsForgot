import { expect, test } from '@playwright/test'
import { logInAsNewPerson } from './people'

test('phone tab bar: readable labels and a clearly marked current tab', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('phone'), 'the tab bar is the phone layout')
  await logInAsNewPerson(page)
  const bar = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true })
  const items = bar.getByRole('link', { name: 'Items' })
  const money = bar.getByRole('link', { name: 'Money' })
  await expect(items).toHaveAttribute('aria-current', 'page')
  await expect(money).not.toHaveAttribute('aria-current', 'page')

  const look = (link: typeof items) =>
    link.evaluate((el) => {
      const s = getComputedStyle(el)
      const root = getComputedStyle(document.documentElement)
      return {
        color: s.color,
        size: parseFloat(s.fontSize),
        weight: Number(s.fontWeight),
        text: getComputedStyle(document.body).color,
        accent: root.getPropertyValue('--c-accent').trim(),
      }
    })
  const toRgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

  const current = await look(items)
  expect(current.color).toBe(toRgb(current.accent))
  expect(current.weight).toBeGreaterThanOrEqual(700)
  const other = await look(money)
  expect(other.color).toBe(other.text)
  expect(other.size).toBeGreaterThanOrEqual(13)

  await money.click()
  await expect(money).toHaveAttribute('aria-current', 'page')
  await expect(items).not.toHaveAttribute('aria-current', 'page')
})

test('phone tab bar: labels sit a little above the bottom edge; + and messages stay clear', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('phone'), 'the tab bar is the phone layout')
  await logInAsNewPerson(page)
  const bar = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true })
  const padding = await bar.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom))
  expect(padding).toBeGreaterThanOrEqual(6)
  expect(padding).toBeLessThanOrEqual(10 + 34) // plus the home-indicator inset in the home-screen app

  // each tab is a comfortable tap target
  const tab = (await bar.getByRole('link', { name: 'Items' }).boundingBox())!
  expect(tab.height).toBeGreaterThanOrEqual(44)

  // the + button floats the same distance above the bar as from the right edge
  const barBox = (await bar.boundingBox())!
  const plus = (await page.getByRole('button', { name: 'Add Item' }).filter({ visible: true }).last().boundingBox())!
  const right = page.viewportSize()!.width - (plus.x + plus.width)
  expect(Math.abs(barBox.y - (plus.y + plus.height) - right)).toBeLessThan(2)
})
