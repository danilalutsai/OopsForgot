import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { signUpPerson } from './people.ts'

const local = JSON.parse(
  execSync('pnpm exec supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(),
)
const fetchFeed = (token: string) => fetch(`${local.API_URL}/functions/v1/calendar-feed?token=${token}`)
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

describe('Calendar feed', () => {
  it("shows only the person's own Items, with no notes or price", async () => {
    const ana = await signUpPerson('Ana')
    const ben = await signUpPerson('Ben')
    await ana.client.from('items').insert({
      name: 'Ana passport',
      category: 'documents',
      due_date: inDays(30),
      price_cents: 9900,
      notes: 'secret note',
    })
    await ben.client.from('items').insert({ name: 'Ben car', category: 'vehicle', due_date: inDays(30) })
    const { data: token } = await ana.client.rpc('new_calendar_link')
    const res = await fetchFeed(token as string)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/calendar')
    const text = await res.text()
    expect(text).toContain('Ana passport — Due')
    expect(text).not.toContain('Ben car')
    expect(text).not.toContain('secret note')
    expect(text).not.toContain('99')
  })

  it('resetting the link kills the old one; turning it off kills it too', async () => {
    const ana = await signUpPerson('Ana')
    const { data: first } = await ana.client.rpc('new_calendar_link')
    const { data: second } = await ana.client.rpc('new_calendar_link')
    expect((await fetchFeed(first as string)).status).toBe(404)
    expect((await fetchFeed(second as string)).status).toBe(200)
    await ana.client.rpc('turn_off_calendar_feed')
    expect((await fetchFeed(second as string)).status).toBe(404)
  })

  it("Ben cannot see Ana's link", async () => {
    const ana = await signUpPerson('Ana')
    const ben = await signUpPerson('Ben')
    await ana.client.rpc('new_calendar_link')
    const { data } = await ben.client.from('profiles').select('calendar_token').eq('id', ana.id)
    expect(data).toEqual([])
  })
})
