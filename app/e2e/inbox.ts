import { expect } from '@playwright/test'

// Local Supabase catches every email in Mailpit instead of sending it.
const MAILPIT = 'http://127.0.0.1:54324/api/v1'

/** The first link in the newest email sent to `to`, waiting for it to arrive. */
export async function linkFromEmail(to: string): Promise<string> {
  let id: string | undefined
  await expect
    .poll(async () => {
      const res = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${to}"`)}`)
      id = (await res.json()).messages?.[0]?.ID
      return id
    })
    .toBeTruthy()
  const message = await (await fetch(`${MAILPIT}/message/${id}`)).json()
  const link = (message.HTML as string).match(/href="([^"]+)"/)?.[1]
  if (!link) throw new Error(`No link in email to ${to}`)
  return link.replaceAll('&amp;', '&')
}

/** Deletes every email sent to `to`, so the next `linkFromEmail` waits for a new one. */
export async function clearInbox(to: string) {
  await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${to}"`)}`, { method: 'DELETE' })
}
