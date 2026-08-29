import * as React from "react"
import { Text } from "@react-email/components"
import { BrandedEmail, emailStyles } from "./components/email-layout"

export function WaitlistJoinedEmail({ name }: { name?: string | null }) {
  const greeting = name?.trim() ? `You're on the list, ${name.trim()}.` : "You're on the list."
  return (
    <BrandedEmail preview="You're on the waitlist">
      <Text style={emailStyles.heading}>{greeting}</Text>
      <Text style={emailStyles.paragraph}>
        Thanks for joining the waitlist. We&apos;ll email you when there&apos;s news.
      </Text>
      <Text style={emailStyles.fineprint}>
        If you didn&apos;t request this, you can ignore this email.
      </Text>
    </BrandedEmail>
  )
}

export default WaitlistJoinedEmail
