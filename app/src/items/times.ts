/** A Finish time is fine when there is none, or when it comes after the Start time on the same day. */
export function finishAfterStart(start: string, finish: string): boolean {
  return !finish || (!!start && finish > start)
}
