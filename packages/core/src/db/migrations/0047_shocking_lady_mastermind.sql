ALTER TABLE "app_settings" ADD COLUMN "feature_flags" jsonb;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;