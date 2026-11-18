import { expect, it } from 'vitest'
import { anonymous } from './people.ts'

it('anyone can call keep_alive, which touches the database', async () => {
  const { data, error } = await anonymous().rpc('keep_alive')
  expect(error).toBeNull()
  expect(typeof data).toBe('string')
})
