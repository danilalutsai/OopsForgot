/**
 * Reads a typed amount ("12.50", "12,5", "420") into whole cents.
 * Returns null for anything that isn't a positive amount with at most 2 decimals.
 */
export function parseAmount(text: string): number | null {
  const match = text.trim().match(/^(\d+)(?:[.,](\d{1,2}))?$/)
  if (!match) return null
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return cents > 0 ? cents : null
}
