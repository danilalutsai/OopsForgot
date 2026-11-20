import { expect, test, type Locator, type Page } from '@playwright/test'
import { logInAsNewPerson } from './people'

/**
 * The average colour of a 1px strip just outside each side of `cell`, read from a real screenshot.
 * The selected day's ring is drawn there, so all four strips must be ring-coloured.
 */
async function edgeColours(page: Page, cell: Locator) {
  const box = (await cell.boundingBox())!
  // whole-pixel clip; the cell's edges inside it (often fractional)
  const clip = { x: Math.floor(box.x) - 6, y: Math.floor(box.y) - 6, width: 0, height: 0 }
  clip.width = Math.ceil(box.x + box.width) + 6 - clip.x
  clip.height = Math.ceil(box.y + box.height) + 6 - clip.y
  const edges = {
    left: box.x - clip.x,
    top: box.y - clip.y,
    right: box.x + box.width - clip.x,
    bottom: box.y + box.height - clip.y,
  }
  const png = (await page.screenshot({ clip, scale: 'css' })).toString('base64')
  return page.evaluate(
    async ({ png, e }) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob())
      const ctx = new OffscreenCanvas(img.width, img.height).getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const at = (x: number, y: number, w: number, h: number) => {
        const d = ctx.getImageData(x, y, w, h).data
        const sum = [0, 0, 0]
        for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) sum[c]! += d[i + c]!
        return sum.map((s) => Math.round(s / (d.length / 4)))
      }
      // the ring is 2px wide just outside the cell: one pixel wholly inside it, away from the rounded corners
      const before = (edge: number) => Math.ceil(edge - 2)
      const after = (edge: number) => Math.ceil(edge)
      const x0 = Math.ceil(e.left) + 10
      const y0 = Math.ceil(e.top) + 10
      const w = Math.floor(e.right) - 10 - x0
      const h = Math.floor(e.bottom) - 10 - y0
      return {
        top: at(x0, before(e.top), w, 1),
        bottom: at(x0, after(e.bottom), w, 1),
        left: at(before(e.left), y0, 1, h),
        right: at(after(e.right), y0, 1, h),
        outside: at(0, y0, 1, h),
      }
    },
    { png, e: edges },
  )
}

const distance = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)))

for (const scheme of ['light', 'dark'] as const)
  for (const view of ['Week', 'Month'] as const)
    test(`the selected day shows its whole border: ${view.toLowerCase()} view, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await logInAsNewPerson(page)
      await page.getByRole('tab', { name: 'Calendar' }).click()
      await page.getByRole('button', { name: view, exact: true }).click()
      const days = page.getByTestId('calendar-days').getByRole('button')
      // the last day in view sits on the bottom row and at the right edge, where clipping shows first
      const cell = days.last()
      await cell.click()
      await expect(cell).toHaveAttribute('aria-pressed', 'true')
      // the first day sits at the left edge
      for (const target of [cell, days.first()]) {
        await target.click()
        await page.waitForTimeout(100)
        const c = await edgeColours(page, target)
        // the ring stands out from the page around it…
        expect(distance(c.top, c.outside)).toBeGreaterThan(40)
        // …and the other three sides are drawn just like the top
        for (const side of ['bottom', 'left', 'right'] as const)
          expect(distance(c[side], c.top), `${side} side of the ring`).toBeLessThan(30)
      }
    })
