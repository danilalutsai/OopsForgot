import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './axe'
import { addEvents, inDays, logInAsNewPerson } from './people'

async function addItem(page: Page, name: string, days: number, times?: [string, string]) {
  await page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }).first().click()
  await page.getByLabel('Name').fill(name)
  await page.getByText('Documents').click()
  await page.getByLabel('Event date').fill(await inDays(page, days))
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

test('Expired Events wait above Today, hidden until "↑ Expired"; oldest first, all in grey', async ({ page }) => {
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
  // open: the button moves to the EXPIRED header as "Hide"
  await expect(button).toHaveCount(0)
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

  // "Hide" closes it again
  await page.getByRole('button', { name: 'Hide', exact: true }).click()
  await expect(expired(page)).toBeHidden()
})

test('no Expired Events: no "Expired" button', async ({ page }) => {
  await logInAsNewPerson(page)
  await addItem(page, 'Gym card', 0)
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(expiredButton(page)).toHaveCount(0)
})

test('an Event with a Finish time is Expired right after it, on the same day', async ({ page }) => {
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

test('calendar: Expired Events still show on their day, in grey', async ({ page }) => {
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
  const day = page.getByRole('button', { name: `${label}, 1 Event` })
  await expect(day.locator('span span').first()).toHaveClass(/bg-urgent-grey/)
  await day.click()
  const visa = page.getByRole('listitem').filter({ hasText: 'Visa' })
  await expect(visa.getByTestId('urgency-bar')).toHaveClass(/bg-urgent-grey/)
})

test('Settings: choose how long Expired Events stay', async ({ page }) => {
  await logInAsNewPerson(page)
  await page.goto('/settings')
  const line = page.getByRole('button', { name: /^Delete Expired Events after/ })
  await expect(line).toContainText('1 month')
  await line.click()
  await page
    .locator('label')
    .filter({ hasText: /^\s*1 week\s*$/ })
    .click()
  await expect(page.getByRole('radio', { name: '1 week' })).toBeChecked()
  await expect(line).toContainText('1 week')
  await page.reload()
  await expect(page.getByRole('button', { name: /^Delete Expired Events after/ })).toContainText('1 week')
})

test.describe('Expired: open at the newest, HIDE back to the top', () => {
  /** 20 Expired Events, oldest first (E01 … E20), and enough upcoming ones to fill the screen. */
  async function longList(page: Page) {
    const me = await logInAsNewPerson(page)
    const expiredOnes = await Promise.all(
      Array.from({ length: 20 }, async (_, n) => ({
        name: `E${String(n + 1).padStart(2, '0')}`,
        due_date: await inDays(page, -21 + n),
      })),
    )
    const upcoming = await Promise.all(
      ['Car insurance', 'Safari test', 'Netflix', 'Cinema', 'Water bill', 'Dentist'].map(async (name, n) => ({
        name,
        due_date: await inDays(page, n === 0 ? 0 : n * 3),
      })),
    )
    await addEvents(me.id, [...expiredOnes, ...upcoming])
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  }
  /** Waits until a smooth scroll has come to rest. */
  const settled = (page: Page) =>
    expect
      .poll(async () => {
        const a = await page.evaluate(() => window.scrollY)
        await page.waitForTimeout(100)
        return a === (await page.evaluate(() => window.scrollY))
      })
      .toBe(true)
  const style = (l: import('@playwright/test').Locator) =>
    l.evaluate((el) => {
      const s = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return {
        font: `${s.fontSize} ${s.fontWeight} ${s.letterSpacing} ${s.textTransform} ${s.color}`,
        middle: r.top + r.height / 2,
        height: r.height,
      }
    })

  test('the TODAY header and "↑ EXPIRED" are a matched pair; rows under headers show in full', async ({ page }) => {
    await longList(page)
    const title = page.getByRole('heading', { name: 'Today' })
    const button = page.getByRole('button', { name: 'Expired', exact: true })
    const [t, b] = [await style(title), await style(button)]
    expect(b.font).toBe(t.font)
    expect(t.font).toContain('uppercase')
    expect(Math.abs(b.middle - t.middle)).toBeLessThan(2)
    expect(b.height).toBeGreaterThanOrEqual(44)
    expect(await button.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('0px')
    // the first row under each header shows in full
    for (const name of ['Today', 'This week', 'Later']) {
      const header = (await page.getByRole('heading', { name }).locator('..').boundingBox())!
      const first = (await page.getByRole('region', { name }).getByRole('listitem').first().boundingBox())!
      expect(first.y).toBeGreaterThanOrEqual(header.y + header.height - 0.5)
    }
  })

  test('opening shows the newest Expired right above TODAY; HIDE brings TODAY back to the top', async ({ page }) => {
    await longList(page)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    const listTop = (await page.getByRole('heading', { name: 'Today' }).boundingBox())!.y

    await page.getByRole('button', { name: 'Expired', exact: true }).click()
    const expiredList = page.getByRole('region', { name: 'Expired' })
    await expect(expiredList.getByRole('listitem').filter({ hasText: 'E20' })).toBeInViewport()
    await expect(expiredList.getByRole('listitem').filter({ hasText: 'E01' })).not.toBeInViewport()
    // order stays: oldest at the top, newest right above TODAY
    await expect(expiredList.getByRole('listitem').first()).toContainText('E01')
    await expect(expiredList.getByRole('listitem').last()).toContainText('E20')

    // HIDE sits in the EXPIRED header, styled like the title
    await settled(page)
    await page.evaluate(() => window.scrollTo(0, 0))
    await settled(page)
    // away from the buttons: hovering darkens them on purpose
    await page.mouse.move(1, 1)
    const hide = page.getByRole('button', { name: 'Hide', exact: true })
    const [t, h] = [await style(page.getByRole('heading', { name: 'Expired' })), await style(hide)]
    expect(h.font).toBe(t.font)
    expect(Math.abs(h.middle - t.middle)).toBeLessThan(2)
    await expect(page.getByRole('button', { name: 'Expired', exact: true })).toHaveCount(0)

    await page.getByRole('listitem').filter({ hasText: 'E10' }).scrollIntoViewIfNeeded()
    await page.getByRole('heading', { name: 'Expired' }).scrollIntoViewIfNeeded()
    await hide.click()
    await expect(expiredList).toBeHidden()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await settled(page)
    expect((await page.getByRole('heading', { name: 'Today' }).boundingBox())!.y).toBeCloseTo(listTop, 0)
    await expect(page.getByRole('button', { name: 'Expired', exact: true })).toBeVisible()
  })
})

test('the sticky section headers never cover the tab bar or the + button', async ({ page }, info) => {
  test.skip(info.project.name.startsWith('computer'), 'phone only')
  const me = await logInAsNewPerson(page)
  await addEvents(
    me.id,
    await Promise.all(
      Array.from({ length: 14 }, async (_, n) => ({ name: `Event ${n + 1}`, due_date: await inDays(page, n * 3) })),
    ),
  )
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  for (const y of [0, 300, 700]) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    for (const target of [
      page.getByRole('navigation', { name: 'Main' }).filter({ visible: true }),
      page.getByRole('button', { name: 'Add Event' }).filter({ visible: true }),
    ]) {
      const box = (await target.boundingBox())!
      const onTop = await page.evaluate(
        ([x, yy]) => document.elementFromPoint(x!, yy!)?.closest('nav, button')?.getAttribute('aria-label'),
        [box.x + box.width / 2, box.y + box.height / 2],
      )
      expect(onTop).toBeTruthy()
    }
  }
})
