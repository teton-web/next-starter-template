CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"checkout_session_id" text,
	"payment_intent_id" text,
	"amount" integer,
	"currency" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
