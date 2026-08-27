"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { forgetPassword } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AuthShell } from "@/components/auth-shell"

export function ForgotPasswordForm({ recoveryEnabled }: { recoveryEnabled: boolean }) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)
    setLoading(true)

    try {
      const result = await forgetPassword(email)

      if (result.error) {
        setError(
          result.error.status === 429
            ? "Too many requests. Please try again shortly."
            : result.error.message || "Failed to send password reset email",
        )
      } else {
        setSuccess(true)
      }
    } catch (err) {
      console.error("Forgot password error:", err)
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      heading="Forgot password"
      description={
        recoveryEnabled
          ? "Enter your email to receive a password reset link"
          : "Password recovery is not configured on this site"
      }
      footer={
        <Link href="/login" className="text-primary hover:underline">
          Back to login
        </Link>
      }
    >
      {recoveryEnabled ? (
        success ? (
          <div role="status" className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 p-3 rounded-md">
            If an account with that email exists, we&apos;ve sent a password reset link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            {error && (
              <div role="alert" className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-md">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        )
      ) : (
        <div role="status" className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
          Email delivery is not configured, so password reset links cannot be sent. Sign in with your password or ask an administrator to reset it.
        </div>
      )}
    </AuthShell>
  )
}
