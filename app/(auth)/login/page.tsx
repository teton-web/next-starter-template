import { Suspense } from "react"
import { AuthShell } from "@/components/auth-shell"
import { isResendConfigured } from "@/lib/auth"
import { LoginForm } from "./login-form"

export default function LoginPage() {
  const magicLinkEnabled = isResendConfigured()

  return (
    <Suspense fallback={<AuthShell heading="Sign in" description="Loading..."><div className="h-10 animate-pulse rounded bg-muted" /></AuthShell>}>
      <LoginForm magicLinkEnabled={magicLinkEnabled} />
    </Suspense>
  )
}
