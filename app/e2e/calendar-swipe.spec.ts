import { expect, test, type Locator, type Page } from '@playwright/test'
import { logInAsNewPerson } from './people'

// the app's test setup turns motion off; swiping is about motion
test.use({ contextOptions: { reducedMotion: 'no-preference' } })

async function openCalendar(page: Page) {
  await logInAsNewPerson(page)
  await page.getByRole('tab', { name: 'Calendar' }).click()
  return page.getByRole('heading', { level: 2 }).first()
}
const grid = (page: Page) => page.getByTestId('calendar-days')

/** A finger swipe: touch-style pointer events (Playwright has no real touch drag in WebKit). */
async function swipe(area: Locator, dx: number, dy = 0) {
  const box = (await area.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const at = (n: number) => ({
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
    clientX: x + (dx * n) / 8,
    clientY: y + (dy * n) / 8,
    buttons: 1,
  })
  await area.dispatchEvent('pointerdown', at(0))
  for (let n = 1; n <= 8; n++) await area.dispatchEvent('pointermove', at(n))
  await area.dispatchEvent('pointerup', { ...at(8), buttons: 0 })
}

/** What the title says one period forward and back, worked out with the buttons. */
async function titles(page: Page, title: Locator) {
  const now = await title.textContent()
  await page.getByRole('button', { name: 'Next' }).click()
  const next = await title.textContent()
  await page.getByRole('button', { name: 'Previous' }).click()
  await page.getByRole('button', { name: 'Previous' }).click()
  const previous = await title.textContent()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(title).toHaveText(now!)
  return { now: now!, next: next!, previous: previous! }
}

test('phone: swipe left for the next month or week, right for the previous', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('phone'), 'finger swipe')
  const title = await openCalendar(page)
  for (const view of ['Month', 'Week']) {
    await page.getByRole('button', { name: view, exact: true }).click()
    const t = await titles(page, title)
    await swipe(grid(page), -160)
    await expect(title).toHaveText(t.next)
    await swipe(grid(page), 160)
    await expect(title).toHaveText(t.now)
    await swipe(grid(page), 160)
    await expect(title).toHaveText(t.previous)
    await page.getByRole('button', { name: 'Next' }).click()
  }
})

test('phone: a short swipe snaps back, a vertical one scrolls, a tap still picks the day', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('phone'), 'finger swipe')
  const title = await openCalendar(page)
  const before = await title.textContent()
  await swipe(grid(page), -30)
  await expect(title).toHaveText(before!)
  await expect
    .poll(() => grid(page).evaluate((el) => getComputedStyle(el).transform))
    .toMatch(/none|matrix\(1, 0, 0, 1, 0, 0\)/)
  await swipe(grid(page), -20, 160)
  await expect(title).toHaveText(before!)

  const day = grid(page).getByRole('button').nth(10)
  await day.click()
  await expect(day).toHaveAttribute('aria-pressed', 'true')
})

test('phone: with reduced motion the period just switches, without following the finger', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('phone'), 'finger swipe')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const title = await openCalendar(page)
  const t = await titles(page, title)
  const box = (await grid(page).boundingBox())!
  const base = { pointerId: 7, pointerType: 'touch', isPrimary: true, clientY: box.y + 40, buttons: 1 }
  await grid(page).dispatchEvent('pointerdown', { ...base, clientX: box.x + 200 })
  await grid(page).dispatchEvent('pointermove', { ...base, clientX: box.x + 120 })
  await grid(page).dispatchEvent('pointermove', { ...base, clientX: box.x + 40 })
  expect(await grid(page).evaluate((el) => getComputedStyle(el).transform)).toMatch(/none|matrix\(1, 0, 0, 1, 0, 0\)/)
  await grid(page).dispatchEvent('pointerup', { ...base, clientX: box.x + 40, buttons: 0 })
  await expect(title).toHaveText(t.next)
})

test('computer: drag with the mouse or swipe the trackpad sideways', async ({ page }, info) => {
  test.skip(info.project.name !== 'computer-chromium', 'mouse and trackpad')
  const title = await openCalendar(page)
  const t = await titles(page, title)
  const picked = await page.locator('section h2').textContent()
  const box = (await grid(page).boundingBox())!
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width * 0.7, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.2, y, { steps: 10 })
  await page.mouse.up()
  await expect(title).toHaveText(t.next)
  // the drag doesn't count as a click on the day under the mouse: the picked day stays
  await expect(page.locator('section h2')).toHaveText(picked!)

  await page.getByRole('button', { name: 'Previous' }).click()
  await expect(title).toHaveText(t.now)
  // a trackpad swipe arrives as sideways wheel events
  await page.mouse.move(box.x + box.width / 2, y)
  for (let n = 0; n < 6; n++) await page.mouse.wheel(-30, 0)
  await expect(title).toHaveText(t.previous)
})

test('phone: while dragging, the calendar follows the finger', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('phone'), 'finger swipe')
  const title = await openCalendar(page)
  const before = await title.textContent()
  const box = (await grid(page).boundingBox())!
  const base = { pointerId: 7, pointerType: 'touch', isPrimary: true, clientY: box.y + 40, buttons: 1 }
  await grid(page).dispatchEvent('pointerdown', { ...base, clientX: box.x + 300 })
  for (const x of [280, 240, 200, 170]) await grid(page).dispatchEvent('pointermove', { ...base, clientX: box.x + x })
  const shift = await grid(page).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41)
  expect(shift).toBeCloseTo(-130, 0)
  // let go back where it started: too short, it snaps back
  await grid(page).dispatchEvent('pointerup', { ...base, clientX: box.x + 300, buttons: 0 })
  await expect.poll(() => grid(page).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41)).toBe(0)
  await expect(title).toHaveText(before!)
})
