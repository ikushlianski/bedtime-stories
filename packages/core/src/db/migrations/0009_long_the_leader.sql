ALTER TABLE "stories" ADD COLUMN "mode" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "text_change_summary" text;