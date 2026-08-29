CREATE TYPE "public"."gallery_album_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "gallery_album_items" (
	"album_id" text NOT NULL,
	"media_asset_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_album_items_album_id_media_asset_id_pk" PRIMARY KEY("album_id","media_asset_id")
);
--> statement-breakpoint
CREATE TABLE "gallery_albums" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "gallery_album_status" DEFAULT 'draft' NOT NULL,
	"cover_media_asset_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gallery_album_items" ADD CONSTRAINT "gallery_album_items_album_id_gallery_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."gallery_albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_album_items" ADD CONSTRAINT "gallery_album_items_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_albums" ADD CONSTRAINT "gallery_albums_cover_media_asset_id_media_assets_id_fk" FOREIGN KEY ("cover_media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_gallery_album_items_album_id" ON "gallery_album_items" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "idx_gallery_album_items_media_asset_id" ON "gallery_album_items" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "idx_gallery_album_items_sort_order" ON "gallery_album_items" USING btree ("album_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gallery_albums_slug" ON "gallery_albums" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_gallery_albums_status" ON "gallery_albums" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_gallery_albums_sort_order" ON "gallery_albums" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_gallery_albums_cover_media_asset_id" ON "gallery_albums" USING btree ("cover_media_asset_id");