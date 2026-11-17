/** True when notes hold 8 or more digits in a row, which may be a full card or document number. */
export function looksLikeFullNumber(notes: string): boolean {
  return /\d{8,}/.test(notes)
}
