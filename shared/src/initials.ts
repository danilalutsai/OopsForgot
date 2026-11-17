/** Two avatar letters: first letter of the name and of the first surname word ("Ana", "García López" → "AG"). */
export function initials(name: string, surname: string): string {
  const first = (word: string) => [...word.trim()][0]?.toLocaleUpperCase() ?? ''
  return first(name) + first(surname.trim().split(/\s+/)[0] ?? '')
}
