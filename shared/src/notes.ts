/**
 * True when notes hold 8 or more digits in a row, which may be a full card or document number.
 * Single spaces or dashes between digits still count, as in "4111 1111 1111 1111".
 */
export function looksLikeFullNumber(notes: string): boolean {
  return /\d(?:[ -]?\d){7,}/.test(notes)
}
