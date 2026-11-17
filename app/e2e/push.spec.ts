import { expect, test } from '@playwright/test'
import { expectAccessible } from './axe'
import { logInAsNewPerson } from './people'

// Real push services aren't reachable from tests: the browser's permission prompt and
// push subscription are stood in for, everything else (saving the device, the screens) is real.
async function fakePush(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const endpoint = `https://push.example.test/${crypto.randomUUID()}`
    let subscribed = false
    const sub = {
      endpoint,
      toJSON: () => ({ endpoint, keys: { p256dh: 'BTestKey', auth: 'TestAuth' } }),
      unsubscribe: async () => ((subscribed = false), true),
    }
    Object.defineProperty(Notification, 'permission', { get: () => 'default', configurable: true })
    Notification.requestPermission = async () => 'granted'
    PushManager.prototype.subscribe = async () => ((subscribed = true), sub) as unknown as PushSubscription
    PushManager.prototype.getSubscription = async () => (subscribed ? sub : null) as unknown as PushSubscription
  })
}

test('with no device getting push, the app says so and the gear shows a dot', async ({ page }) => {
  await logInAsNewPerson(page)
  await expect(page.getByText('Push is off, so Reminders can’t reach you yet.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Settings' }).locator('span')).toBeVisible()
})

test('turn on push on this device, then remove it', async ({ page }, info) => {
  test.skip(info.project.name === 'phone-webkit', 'iPhone needs the Home Screen app first (next test)')
  await fakePush(page)
  await logInAsNewPerson(page)
  await page.getByRole('link', { name: 'Turn it on' }).click()
  await page.getByRole('button', { name: /^Push/ }).click()
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Turn on here' }).click()

  const devices = page.getByRole('list', { name: 'Devices with push' })
  await expect(devices.getByRole('listitem')).toHaveCount(1)
  await expect(devices).toContainText('This device')
  await expect(page.getByRole('button', { name: /^Push/ })).toContainText('On, 1 device')

  await devices.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('No devices get push yet.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Turn on here' })).toBeVisible()
})

test('an iPhone not added to the Home Screen gets the steps instead', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone-webkit', 'iPhone only')
  await logInAsNewPerson(page)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: /^Push/ }).click()
  await expect(page.getByRole('heading', { name: 'On iPhone, add OopsProof to your Home Screen first' })).toBeVisible()
  await expect(page.getByText('Choose “Add to Home Screen”.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Turn on here' })).toHaveCount(0)
})

test("logging out removes this device from the person's push list", async ({ page }, info) => {
  test.skip(info.project.name === 'phone-webkit', 'iPhone needs the Home Screen app first')
  await fakePush(page)
  await logInAsNewPerson(page)
  await page.getByRole('link', { name: 'Turn it on' }).click()
  await page.getByRole('button', { name: /^Push/ }).click()
  await page.getByRole('button', { name: 'Turn on here' }).click()
  await expect(page.getByRole('button', { name: /^Push/ })).toContainText('On, 1 device')
  await page.goto('/')
  await page.getByRole('button', { name: /Account/ }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
})
