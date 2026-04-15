CREATE TABLE "child_diary" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "structured_feedback" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "run_snapshots" ADD COLUMN "sasha_context" text;