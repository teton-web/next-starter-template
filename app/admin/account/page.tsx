"use client"

import type React from "react"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { changePassword, useSession } from "@/lib/auth-client"
import { postPasswordChangeUrl } from "@/lib/auth/callback-url-pure"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function AdminAccountForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const mustChangePassword = session?.user?.mustChangePassword === true
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      const result = await changePassword(currentPassword, newPassword)
      if (result.error) {
        setError(result.error.message || "Failed to change password")
      } else {
        setSuccess("Password changed successfully")
        setCurrentPassword("")
        setNewPassword("")
        router.push(postPasswordChangeUrl(searchParams.get("callbackUrl")))
        router.refresh()
      }
    } catch {
      setError("An error occurred while changing password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-sm text-muted-foreground">Update the password for {session?.user?.email}</p>
      </div>

      {mustChangePassword ? (
        <div role="status" className="max-w-md rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          You must change your password before using the rest of the admin panel.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div className="space-y-2">
          <label htmlFor="currentPassword" className="text-sm font-medium">
            Current password
          </label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="newPassword" className="text-sm font-medium">
            New password
          </label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            disabled={loading}
          />
        </div>
        {error && (
          <div role="alert" className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 p-3 rounded-md">
            {success}
          </div>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Change password"}
        </Button>
      </form>
    </div>
  )
}

export default function AdminAccountPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8 text-sm text-muted-foreground">Loading...</div>}>
      <AdminAccountForm />
    </Suspense>
  )
}
