import { expect, it } from 'vitest'
import { initials } from './initials.ts'

it('takes the first letter of the name and of the first surname word', () => {
  expect(initials('Ana', 'García López')).toBe('AG')
})

it('copes with lowercase and extra spaces', () => {
  expect(initials(' ben ', '  de la Cruz ')).toBe('BD')
})
