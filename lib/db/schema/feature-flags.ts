import { relations } from "drizzle-orm"
import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { users } from "./users"

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().default({}).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
})

export const featureFlagsRelations = relations(featureFlags, ({ one }) => ({
  updatedBy: one(users, {
    fields: [featureFlags.updatedByUserId],
    references: [users.id],
  }),
}))

export type FeatureFlag = typeof featureFlags.$inferSelect
export type NewFeatureFlag = typeof featureFlags.$inferInsert
