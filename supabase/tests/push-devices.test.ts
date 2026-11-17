import { describe, expect, it } from 'vitest'
import { signUpPerson } from './people.ts'

const device = (n = crypto.randomUUID()) => ({
  endpoint: `https://push.example.test/${n}`,
  p256dh: 'BPublicKey',
  auth: 'secret',
  label: 'Chrome on Mac',
})

describe('push devices', () => {
  it('a person adds, sees and removes their own device', async () => {
    const ana = await signUpPerson('Ana')
    const { data: added, error } = await ana.client.from('push_devices').insert(device()).select('id').single()
    expect(error).toBeNull()
    expect((await ana.client.from('push_devices').select('label')).data).toEqual([{ label: 'Chrome on Mac' }])
    await ana.client.from('push_devices').delete().eq('id', added!.id)
    expect((await ana.client.from('push_devices').select('id')).data).toEqual([])
  })

  it("Ben cannot see or remove Ana's devices", async () => {
    const ana = await signUpPerson('Ana')
    const ben = await signUpPerson('Ben')
    const { data: added } = await ana.client.from('push_devices').insert(device()).select('id').single()
    expect((await ben.client.from('push_devices').select('id').eq('id', added!.id)).data).toEqual([])
    await ben.client.from('push_devices').delete().eq('id', added!.id)
    expect((await ana.client.from('push_devices').select('id')).data).toHaveLength(1)
  })

  it('only https push endpoints are accepted', async () => {
    const ana = await signUpPerson('Ana')
    const { error } = await ana.client.from('push_devices').insert({ ...device(), endpoint: 'http://evil.test/x' })
    expect(error).not.toBeNull()
  })
})

describe('one browser, several people', () => {
  it("turning push on takes the browser over from whoever had it, so Ana's Reminders stop going there", async () => {
    const ana = await signUpPerson('Ana')
    const ben = await signUpPerson('Ben')
    const shared = device()
    const claim = (client: typeof ana.client) =>
      client.rpc('claim_push_device', {
        p_endpoint: shared.endpoint,
        p_p256dh: shared.p256dh,
        p_auth: shared.auth,
        p_label: shared.label,
      })
    expect((await claim(ana.client)).error).toBeNull()
    expect((await claim(ben.client)).error).toBeNull()
    expect((await ana.client.from('push_devices').select('id')).data).toEqual([])
    expect((await ben.client.from('push_devices').select('endpoint')).data).toEqual([{ endpoint: shared.endpoint }])
  })
})
