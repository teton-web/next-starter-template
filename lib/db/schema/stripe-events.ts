import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  checkoutSessionId: text("checkout_session_id"),
  paymentIntentId: text("payment_intent_id"),
  amount: integer("amount"),
  currency: text("currency"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export type StripeEventRow = typeof stripeEvents.$inferSelect
export type NewStripeEventRow = typeof stripeEvents.$inferInsert
