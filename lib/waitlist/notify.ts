import { Resend } from "resend"
import { renderWaitlistJoinedEmail } from "@/emails/render"

export async function sendWaitlistConfirmation(input: {
  email: string
  name?: string | null
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) return

  const html = await renderWaitlistJoinedEmail({ name: input.name })
  const resend = new Resend(apiKey)
  await resend.emails.send({
    from,
    to: input.email,
    subject: "You're on the waitlist",
    html,
  })
}
