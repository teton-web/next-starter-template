import { NextRequest } from "next/server"
import { and, eq, ne } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { accounts, sessions, users } from "@/lib/db/schema"
import { getSession } from "@/lib/auth"
import { jsonError, jsonOk, parseJson, requireUserId } from "@/lib/api/helpers"
import { z } from "zod"

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()
    if (userId instanceof Response) return userId

    const parsed = await parseJson(request, bodySchema)
    if (parsed instanceof Response) return parsed

    const accountResult = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
      .limit(1)

    const account = accountResult[0]
    const storedPassword = account?.password
    if (!account || !storedPassword) {
      return jsonError("User does not have a password set", 400)
    }

    const isCurrentPasswordValid = await bcrypt.compare(parsed.currentPassword, storedPassword)
    if (!isCurrentPasswordValid) {
      return jsonError("Current password is incorrect", 400)
    }

    if (parsed.newPassword === parsed.currentPassword) {
      return jsonError("New password must be different from the current password", 400)
    }

    const hashedNewPassword = await bcrypt.hash(parsed.newPassword, 10)

    await db
      .update(accounts)
      .set({
        password: hashedNewPassword,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, account.id))

    await db
      .update(users)
      .set({
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    const currentSession = await getSession()
    const currentToken = currentSession?.session?.token
    if (currentToken) {
      await db
        .delete(sessions)
        .where(and(eq(sessions.userId, userId), ne(sessions.token, currentToken)))
    } else {
      await db.delete(sessions).where(eq(sessions.userId, userId))
    }

    return jsonOk({
      success: true,
      message: "Password changed successfully",
    })
  } catch (error) {
    console.error("Failed to change password:", error)
    return jsonError("An error occurred while changing password", 500)
  }
}
