"use client"

import type React from "react"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { signIn, signInGoogle, signInMagicLink } from "@/lib/auth-client"
import { passwordChangeRedirectUrl, safeCallbackUrl } from "@/lib/auth/callback-url-pure"
import { loginQueryErrorMessage } from "@/lib/auth/login-error-pure"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AuthShell } from "@/components/auth-shell"

export function LoginGoogleButton({
  enabled,
  busy,
  loading,
  onClick,
}: {
  enabled: boolean
  busy: boolean
  loading: boolean
  onClick: () => void
}) {
  if (!enabled) return null
  return (
    <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={onClick}>
      {loading ? "Redirecting..." : "Continue with Google"}
    </Button>
  )
}

function errorMessage(error: { message?: string; status?: number } | null | undefined, fallback: string) {
  if (error?.status === 429) {
    return "Too many requests. Please try again shortly."
  }
  return error?.message || fallback
}

export function LoginForm({
  magicLinkEnabled,
  googleEnabled,
}: {
  magicLinkEnabled: boolean
  googleEnabled: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(() => loginQueryErrorMessage(searchParams.get("error")) ?? "")
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [magicLoading, setMagicLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMagicLinkSent(false)
    setLoading(true)

    try {
      const result = await signIn(email, password)

      if (result.error) {
        setError(errorMessage(result.error, "Login failed"))
      } else if (result.data?.user?.mustChangePassword) {
        router.push(passwordChangeRedirectUrl(searchParams.get("callbackUrl")))
        router.refresh()
      } else {
        router.push(safeCallbackUrl(searchParams.get("callbackUrl")))
        router.refresh()
      }
    } catch {
      setError("An error occurred during login")
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLink = async () => {
    setError("")
    setMagicLinkSent(false)
    if (!email) {
      setError("Enter your email to receive a sign-in link")
      return
    }

    setMagicLoading(true)
    try {
      const result = await signInMagicLink(email, safeCallbackUrl(searchParams.get("callbackUrl")))
      if (result.error) {
        setError(errorMessage(result.error, "Failed to send sign-in link"))
      } else {
        setMagicLinkSent(true)
      }
    } catch {
      setError("An error occurred while sending the sign-in link")
    } finally {
      setMagicLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError("")
    setMagicLinkSent(false)
    setGoogleLoading(true)
    try {
      const result = await signInGoogle(safeCallbackUrl(searchParams.get("callbackUrl")))
      if (result.error) {
        setError(errorMessage(result.error, "Login failed"))
        setGoogleLoading(false)
      }
    } catch {
      setError("An error occurred during login")
      setGoogleLoading(false)
    }
  }

  const busy = loading || magicLoading || googleLoading

  return (
    <AuthShell
      heading="Sign in"
      description="Sign in to access the admin panel"
      footer={
        <Link href="/forgot-password" className="text-primary hover:underline">
          Forgot password?
        </Link>
      }
    >
      <form
        onSubmit={handleLogin}
        onInvalid={() => setError("")}
        className="space-y-4"
      >
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError("")
            }}
            required
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError("")
            }}
            required
            disabled={busy}
          />
        </div>
        {error && (
          <div role="alert" className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-md">
            {error}
          </div>
        )}
        {magicLinkSent && (
          <div role="status" className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 p-3 rounded-md">
            If an account with that email exists, we&apos;ve sent a sign-in link.
          </div>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {loading ? "Signing in..." : "Sign In"}
        </Button>
        {magicLinkEnabled ? (
          <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={handleMagicLink}>
            {magicLoading ? "Sending link..." : "Email me a sign-in link"}
          </Button>
        ) : null}
      </form>
      <div className="mt-4">
        <LoginGoogleButton
          enabled={googleEnabled}
          busy={busy}
          loading={googleLoading}
          onClick={handleGoogle}
        />
      </div>
    </AuthShell>
  )
}
