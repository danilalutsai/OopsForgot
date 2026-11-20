import { describe, expect, it } from 'vitest'
import { callFunction } from './functions.ts'
import { signUpPerson } from './people.ts'

async function personWithDevice(name: string) {
  const person = await signUpPerson(name)
  const endpoint = `https://push.example.test/${crypto.randomUUID()}`
  const { error } = await person.client
    .from('push_devices')
    .insert({ endpoint, p256dh: 'BKey', auth: 'secret', label: 'Test phone' })
  expect(error).toBeNull()
  return { ...person, endpoint }
}

describe('Send a test notification', () => {
  it('sends to the asking device right away, then at most once a minute', async () => {
    const ana = await personWithDevice('Ana')
    const first = await callFunction('send-test-notification', ana, { endpoint: ana.endpoint })
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ sent: true })
    const again = await callFunction('send-test-notification', ana, { endpoint: ana.endpoint })
    expect(again.status).toBe(429)
    expect(await again.json()).toEqual({ error: 'tooSoon' })
  })

  it("never sends to someone else's device", async () => {
    const ana = await personWithDevice('Ana')
    const ben = await personWithDevice('Ben')
    const res = await callFunction('send-test-notification', ben, { endpoint: ana.endpoint })
    expect(res.status).toBe(404)
  })
})
