import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core"

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  identifierIdx: index("idx_verifications_identifier").on(table.identifier),
}))

export type Verification = typeof verifications.$inferSelect
export type NewVerification = typeof verifications.$inferInsert
