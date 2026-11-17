import { describe, expect, it } from 'vitest'
import { signUpPerson } from './people.ts'

const columns = 'time_zone, currency, day_reminder_time'

describe('settings on the profile', () => {
  it('starts with the time zone and currency from signup and day Reminders at 12:00', async () => {
    const ana = await signUpPerson('Ana', 'Tester', { time_zone: 'Europe/Tallinn', currency: 'EUR' })
    const { data } = await ana.client.from('profiles').select(columns).single()
    expect(data).toEqual({ time_zone: 'Europe/Tallinn', currency: 'EUR', day_reminder_time: '12:00:00' })
  })

  it('an unknown time zone or currency from the browser never blocks signup', async () => {
    const ana = await signUpPerson('Ana', 'Tester', { time_zone: 'Etc/Unknown', currency: 'euro' })
    const { data } = await ana.client.from('profiles').select('time_zone, currency').single()
    expect(data).toEqual({ time_zone: 'UTC', currency: 'EUR' })
  })

  it("a photo path must be in the person's own folder", async () => {
    const ana = await signUpPerson('Ana')
    const ben = await signUpPerson('Ben')
    const update = (photo_path: string) => ana.client.from('profiles').update({ photo_path }).eq('id', ana.id)
    expect((await update(`${ben.id}/photo.jpg`)).error).not.toBeNull()
    expect((await update(`${ana.id}/photo.jpg`)).error).toBeNull()
  })

  it('a person changes their own time zone, currency and day Reminder time', async () => {
    const ana = await signUpPerson('Ana')
    const { error } = await ana.client
      .from('profiles')
      .update({ time_zone: 'America/New_York', currency: 'USD', day_reminder_time: '08:15' })
      .eq('id', ana.id)
    expect(error).toBeNull()
    const { data } = await ana.client.from('profiles').select(columns).single()
    expect(data).toEqual({ time_zone: 'America/New_York', currency: 'USD', day_reminder_time: '08:15:00' })
  })

  it('refuses unknown time zones, odd currencies and times off the 15-minute steps', async () => {
    const ana = await signUpPerson('Ana')
    const update = (changes: object) => ana.client.from('profiles').update(changes).eq('id', ana.id)
    expect((await update({ time_zone: 'Mars/Olympus' })).error).not.toBeNull()
    expect((await update({ currency: 'euro' })).error).not.toBeNull()
    expect((await update({ day_reminder_time: '08:07' })).error).not.toBeNull()
  })

  it("Ben cannot change Ana's settings", async () => {
    const ana = await signUpPerson('Ana')
    const ben = await signUpPerson('Ben')
    await ben.client.from('profiles').update({ currency: 'USD' }).eq('id', ana.id)
    expect((await ana.client.from('profiles').select('currency').single()).data).toEqual({ currency: 'EUR' })
  })
})

describe('profile photos', () => {
  const photo = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' })

  it('a person uploads a photo into their own folder and reads it back', async () => {
    const ana = await signUpPerson('Ana')
    const path = `${ana.id}/photo.jpg`
    expect((await ana.client.storage.from('avatars').upload(path, photo())).error).toBeNull()
    expect((await ana.client.storage.from('avatars').download(path)).error).toBeNull()
  })

  it("Ben cannot read, replace or add photos in Ana's folder", async () => {
    const ana = await signUpPerson('Ana')
    const ben = await signUpPerson('Ben')
    const path = `${ana.id}/photo.jpg`
    await ana.client.storage.from('avatars').upload(path, photo())
    expect((await ben.client.storage.from('avatars').download(path)).error).not.toBeNull()
    expect((await ben.client.storage.from('avatars').upload(path, photo(), { upsert: true })).error).not.toBeNull()
    expect((await ben.client.storage.from('avatars').upload(`${ana.id}/other.jpg`, photo())).error).not.toBeNull()
  })
})
