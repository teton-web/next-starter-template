import { isResendConfigured } from "@/lib/auth"
import { ForgotPasswordForm } from "./forgot-password-form"

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm recoveryEnabled={isResendConfigured()} />
}
