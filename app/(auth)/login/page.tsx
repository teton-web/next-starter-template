import { Suspense } from "react"
import { AuthShell } from "@/components/auth-shell"
import { isResendConfigured } from "@/lib/auth"
import { isEnabled } from "@/lib/flags/resolve"
import { LoginForm } from "./login-form"

export default async function LoginPage() {
  const magicLinkEnabled = isResendConfigured()
  const googleEnabled = await isEnabled("oauth")

  return (
    <Suspense fallback={<AuthShell heading="Sign in" description="Loading..."><div className="h-10 animate-pulse rounded bg-muted" /></AuthShell>}>
      <LoginForm magicLinkEnabled={magicLinkEnabled} googleEnabled={googleEnabled} />
    </Suspense>
  )
}
