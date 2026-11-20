/** The fixed list of Categories, in the order people pick them. */
export const CATEGORIES = [
  'documents',
  'cards',
  'subscriptions',
  'free_trials',
  'vehicle',
  'home',
  'health',
  'purchases',
  'travel',
  'other',
] as const

export type Category = (typeof CATEGORIES)[number]
