import type { Category } from '@oopsforgot/shared'

/** One colour per Category for the ring and chips; distinct in light and dark, never relied on alone. */
export const CATEGORY_COLORS: Record<Category, string> = {
  documents: '#64748b',
  cards: '#0ea5e9',
  subscriptions: '#8b5cf6',
  free_trials: '#ec4899',
  vehicle: '#f97316',
  home: '#10b981',
  health: '#ef4444',
  purchases: '#eab308',
  travel: '#06b6d4',
  other: '#a3a3a3',
}
