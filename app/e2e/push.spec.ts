import { expect, test } from '@playwright/test'
import { expectAccessible } from './axe'
import { logInAsNewPerson, openFromAvatar } from './people'

// Real push services aren't reachable from tests: the browser's permission prompt and
// push subscription are stood in for, everything else (saving the device, the screens) is real.
async function fakePush(page: import('@playwright/test').Page, { serviceBlocked = false } = {}) {
  await page.addInitScript((blocked) => {
    // like a real subscription, it survives page loads (kept in sessionStorage)
    const endpoint = (sessionStorage.fakeEndpoint ??= `https://push.example.test/${crypto.randomUUID()}`)
    const isOn = () => sessionStorage.fakeSubscribed === '1'
    const sub = {
      endpoint,
      toJSON: () => ({ endpoint, keys: { p256dh: 'BTestKey', auth: 'TestAuth' } }),
      unsubscribe: async () => ((sessionStorage.fakeSubscribed = '0'), true),
    }
    Object.defineProperty(Notification, 'permission', { get: () => 'default', configurable: true })
    Notification.requestPermission = async () => 'granted'
    PushManager.prototype.subscribe = async () => {
      // like Brave with "Use Google services for push messaging" off
      if (blocked) throw new DOMException('Registration failed - push service error', 'AbortError')
      return ((sessionStorage.fakeSubscribed = '1'), sub) as unknown as PushSubscription
    }
    PushManager.prototype.getSubscription = async () => (isOn() ? sub : null) as unknown as PushSubscription
  }, serviceBlocked)
}

test('with no device getting push, the app says so and the avatar shows a dot', async ({ page }) => {
  await logInAsNewPerson(page)
  await expect(page.getByRole('heading', { name: 'Reminders can’t reach you' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Account menu/ }).getByTitle('Needs your attention')).toBeVisible()
})

test('Settings says why the dot is there; Keep off makes the dot and the notes go away', async ({ page }) => {
  await logInAsNewPerson(page)
  const dot = page.getByRole('button', { name: /Account menu/ }).getByTitle('Needs your attention')
  await openFromAvatar(page, 'Settings')
  const card = page.getByRole('region', { name: 'Reminders can’t reach you' })
  await expect(card).toContainText('That’s why the avatar has an amber dot.')
  await expect(page.getByRole('button', { name: /^Notifications/ }).getByTitle('Needs your attention')).toBeVisible()
  await expectAccessible(page)

  // Turn on notifications opens the line where that happens
  await card.getByRole('button', { name: 'Turn on notifications' }).click()
  await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveAttribute('aria-expanded', 'true')

  await card.getByRole('button', { name: 'Keep off' }).click()
  await expect(card).toBeHidden()
  await expect(dot).toBeHidden()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Reminders can’t reach you' })).toBeHidden()
  await expect(dot).toBeHidden()
})

test('the note above the Events offers Keep off too', async ({ page }) => {
  await logInAsNewPerson(page)
  const note = page.getByRole('region', { name: 'Reminders can’t reach you' })
  await expectAccessible(page)
  await note.getByRole('button', { name: 'Keep off' }).click()
  await expect(note).toBeHidden()
  await expect(page.getByRole('button', { name: /Account menu/ }).getByTitle('Needs your attention')).toBeHidden()
})

test('turn on push on this device, then remove it', async ({ page }, info) => {
  test.skip(info.project.name === 'phone-webkit', 'iPhone needs the Home Screen app first (next test)')
  await fakePush(page)
  await logInAsNewPerson(page)
  // straight to Settings, with the Notifications line open
  await page.getByRole('link', { name: 'Turn on notifications' }).click()
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Turn on here' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'This device will get Reminders.' })).toBeVisible()

  const devices = page.getByRole('list', { name: 'Devices with notifications' })
  await expect(devices.getByRole('listitem')).toHaveCount(1)
  await expect(devices).toContainText('This device')
  await expect(page.getByRole('button', { name: /^Notifications/ })).toContainText('On, 1 device')

  await devices.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('No devices get notifications yet.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Turn on here' })).toBeVisible()
})

test('an iPhone not added to the Home Screen gets the steps instead', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone-webkit', 'iPhone only')
  await logInAsNewPerson(page)
  await openFromAvatar(page, 'Settings')
  await page.getByRole('button', { name: /^Notifications/ }).click()
  await expect(page.getByRole('heading', { name: 'On iPhone, add OopsForgot to your Home Screen first' })).toBeVisible()
  await expect(page.getByText('Choose “Add to Home Screen”.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Turn on here' })).toHaveCount(0)
})

test("logging out removes this device from the person's push list", async ({ page }, info) => {
  test.skip(info.project.name === 'phone-webkit', 'iPhone needs the Home Screen app first')
  await fakePush(page)
  const person = await logInAsNewPerson(page)
  // straight to Settings, with the Notifications line open
  await page.getByRole('link', { name: 'Turn on notifications' }).click()
  await page.getByRole('button', { name: 'Turn on here' }).click()
  await expect(page.getByRole('button', { name: /^Notifications/ })).toContainText('On, 1 device')
  await page.goto('/')
  await page.getByRole('button', { name: /Account/ }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()

  // Back in as the same person: this browser is no longer one of their push devices
  await page.getByLabel('Email').fill(person.email)
  await page.getByLabel('Password').fill(person.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Reminders can’t reach you' })).toBeVisible()
})

test('a browser that blocks push (Brave) says what to do, and nothing is saved', async ({ page }, info) => {
  test.skip(info.project.name === 'phone-webkit', 'iPhone needs the Home Screen app first')
  await fakePush(page, { serviceBlocked: true })
  await logInAsNewPerson(page)
  await openFromAvatar(page, 'Settings')
  await page.getByRole('button', { name: /^Notifications/ }).click()
  await page.getByRole('button', { name: 'Turn on here' }).click()
  await expect(page.getByRole('alert')).toContainText('Use Google services for push messaging')
  await expect(page.getByText('This device will get Reminders.')).toHaveCount(0)
  await expect(page.getByText('No devices get notifications yet.')).toBeVisible()
})

test('if saving the device fails, it says so and never claims Reminders will arrive', async ({ page }, info) => {
  test.skip(info.project.name === 'phone-webkit', 'iPhone needs the Home Screen app first')
  await fakePush(page)
  await logInAsNewPerson(page)
  await page.route('**/rest/v1/rpc/claim_push_device**', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"down"}' }),
  )
  await openFromAvatar(page, 'Settings')
  await page.getByRole('button', { name: /^Notifications/ }).click()
  await page.getByRole('button', { name: 'Turn on here' }).click()
  await expect(page.getByRole('alert')).toContainText('saving it didn’t work')
  await expect(page.getByText('This device will get Reminders.')).toHaveCount(0)
})

test('send a test notification to this device; the button rests for a minute after', async ({ page }, info) => {
  test.skip(info.project.name === 'phone-webkit', 'iPhone needs the Home Screen app first')
  await fakePush(page)
  await logInAsNewPerson(page)
  await openFromAvatar(page, 'Settings')
  await page.getByRole('button', { name: /^Notifications/ }).click()
  await expect(page.getByRole('button', { name: 'Send a test notification' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Turn on here' }).click()
  const testButton = page.getByRole('button', { name: 'Send a test notification' })
  await testButton.click()
  await expect(page.getByRole('status').filter({ hasText: 'Sent.' })).toContainText(
    'Sent. It should appear on this device in a few seconds.',
  )
  await expect(testButton).toBeDisabled()
  await expectAccessible(page)
})
