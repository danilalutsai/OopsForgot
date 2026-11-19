// Account emails (not Reminders) sent from the app's Gmail until OopsForgot has its own domain.
// In test mode nothing is sent: the caller reports what would have gone out.
import nodemailer from 'npm:nodemailer@10.6.0'

const env = (name: string) => Deno.env.get(name) ?? ''
// one pooled connection for the whole run, not one per email
// deno-lint-ignore no-explicit-any
let transport: any

export interface Mail {
  to: string
  subject: string
  text: string
}

/** False when mail isn't set up or sending failed; the caller then tries again another day. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const user = env('GMAIL_USER')
  const pass = env('GMAIL_APP_PASSWORD')
  if (!user || !pass) {
    console.error('Account email is not set up (GMAIL_USER / GMAIL_APP_PASSWORD)')
    return false
  }
  try {
    transport ??= nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      pool: true,
      maxConnections: 2,
      auth: { user, pass },
    })
    await transport.sendMail({ from: `OopsForgot <${user}>`, ...mail })
    return true
  } catch (e) {
    console.error('Could not send account email', e)
    return false
  }
}
