"use client"

import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields, magicLinkClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [
    magicLinkClient(),
    inferAdditionalFields({
      user: {
        mustChangePassword: {
          type: "boolean",
        },
      },
    }),
  ],
})

export const useSession = authClient.useSession

export async function signIn(email: string, password: string) {
  return authClient.signIn.email({
    email,
    password,
  })
}

export async function signInMagicLink(email: string, callbackURL = "/admin") {
  return authClient.signIn.magicLink({
    email,
    callbackURL,
  })
}

export async function signOut() {
  await authClient.signOut()
}

export async function forgetPassword(email: string) {
  return authClient.requestPasswordReset({
    email,
    redirectTo: "/reset-password",
  })
}

export async function resetPassword(token: string, newPassword: string) {
  return authClient.resetPassword({
    token,
    newPassword,
  })
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const response = await fetch("/api/admin/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      currentPassword,
      newPassword,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    return {
      error: {
        message: data.error || "Failed to change password",
      },
    }
  }

  return { data, error: null }
}

export interface User {
  id: string
  email: string
  name: string
  mustChangePassword?: boolean
}

export interface Session {
  user: User
}
