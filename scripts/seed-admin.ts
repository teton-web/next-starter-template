import bcrypt from "bcryptjs"
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { accounts, locales, users } from "@/lib/db/schema"

async function seedDefaultLocale() {
  const existingDefault = await db
    .select({ id: locales.id })
    .from(locales)
    .where(eq(locales.isDefault, true))
    .limit(1)

  if (existingDefault[0]) {
    console.log("Default locale already present")
    return
  }

  const existingEn = await db
    .select({ id: locales.id })
    .from(locales)
    .where(eq(locales.code, "en"))
    .limit(1)

  if (existingEn[0]) {
    await db
      .update(locales)
      .set({ isDefault: true })
      .where(eq(locales.id, existingEn[0].id))
    console.log("Default locale en already present")
    return
  }

  await db.insert(locales).values({
    id: crypto.randomUUID(),
    code: "en",
    name: "English",
    isDefault: true,
  })
  console.log("Created default locale en")
}

async function ensureCredentialAccount(userId: string, hashedPassword: string) {
  const credential = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .limit(1)

  if (credential[0]) {
    return false
  }

  await db.insert(accounts).values({
    id: crypto.randomUUID(),
    userId,
    issuer: "local:credential",
    accountId: userId,
    providerId: "credential",
    password: hashedPassword,
  })
  return true
}

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").trim().toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD || "changeme-admin-password"
  const name = process.env.SEED_ADMIN_NAME || "Admin"

  if (!process.env.DATABASE_URL && !process.env.NEON_DATABASE_URL) {
    console.error("DATABASE_URL is required to seed an admin user.")
    process.exit(1)
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1)

  const hashedPassword = await bcrypt.hash(password, 10)

  if (existing[0]) {
    await db
      .update(users)
      .set({
        capabilities: ["admin"],
        deletedAt: null,
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing[0].id))
    const createdCredential = await ensureCredentialAccount(existing[0].id, hashedPassword)
    if (createdCredential) {
      await db
        .update(users)
        .set({
          mustChangePassword: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing[0].id))
    }
    console.log(`Admin user already exists (${email}); capabilities set to admin.`)
  } else {
    const userId = crypto.randomUUID()
    await db.insert(users).values({
      id: userId,
      email,
      name,
      emailVerified: true,
      capabilities: ["admin"],
      mustChangePassword: true,
    })
    await ensureCredentialAccount(userId, hashedPassword)

    console.log(`Created admin user ${email}. Change the password after first login.`)
  }

  await seedDefaultLocale()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
