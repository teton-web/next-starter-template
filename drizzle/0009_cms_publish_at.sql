ALTER TABLE "cms_entries" ADD COLUMN "publish_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "idx_cms_entries_publish_at" ON "cms_entries" USING btree ("publish_at");
