import { and, eq, like } from "drizzle-orm"
import { verifications } from "@/lib/db/schema"

export const RESET_PASSWORD_IDENTIFIER_LIKE = "reset-password:%"

export function resetPasswordVerificationsForUser(userId: string) {
  return and(
    eq(verifications.value, userId),
    like(verifications.identifier, RESET_PASSWORD_IDENTIFIER_LIKE),
  )
}

export async function deleteResetPasswordVerificationsForUser(
  tx: {
    delete: (table: typeof verifications) => {
      where: (condition: ReturnType<typeof resetPasswordVerificationsForUser>) => unknown
    }
  },
  userId: string,
) {
  await tx.delete(verifications).where(resetPasswordVerificationsForUser(userId))
}
