import { describe, expect, it } from 'vitest'
import { anonymous, signUpPerson } from './people.ts'

describe('profiles', () => {
  it("signup creates the person's profile with their Name and Surname", async () => {
    const ana = await signUpPerson('Ana', 'García López')
    const { data } = await ana.client.from('profiles').select('name, surname').single()
    expect(data).toEqual({ name: 'Ana', surname: 'García López' })
  })

  it('signup without the 16+ confirmation is refused', async () => {
    const { error } = await anonymous().auth.signUp({
      email: `young.${crypto.randomUUID()}@example.test`,
      password: 'correct-horse-battery',
      options: { data: { name: 'Young', surname: 'Person' } },
    })
    expect(error).not.toBeNull()
  })

  it("Ben cannot read or change Ana's profile", async () => {
    const ana = await signUpPerson('Ana')
    const ben = await signUpPerson('Ben')
    const read = await ben.client.from('profiles').select('id').eq('id', ana.id)
    expect(read.data).toEqual([])
    await ben.client.from('profiles').update({ name: 'Hacked' }).eq('id', ana.id)
    const own = await ana.client.from('profiles').select('name').single()
    expect(own.data?.name).toBe('Ana')
  })
})
