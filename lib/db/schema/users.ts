import { pgTable, text, timestamp, index, jsonb, boolean } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { sessions } from "./sessions"
import { accounts } from "./accounts"
import { memberships } from "./memberships"
import { notifications } from "./notifications"
import { notificationPreferences } from "./notification-preferences"
import { auditLogs } from "./audit-logs"
import { files } from "./files"

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  capabilities: jsonb("capabilities").$type<string[]>().default([]),
  deletedAt: timestamp("deleted_at"),
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("idx_users_email").on(table.email),
}))

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  memberships: many(memberships),
  notifications: many(notifications),
  notificationPreferences: many(notificationPreferences),
  auditLogs: many(auditLogs),
  files: many(files),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
