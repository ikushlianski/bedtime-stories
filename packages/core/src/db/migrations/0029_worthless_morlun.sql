CREATE TABLE "story_ideas" (
	"id" serial PRIMARY KEY NOT NULL,
	"universe_id" integer NOT NULL,
	"topic" text NOT NULL,
	"seed_text" text NOT NULL,
	"rationale" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "story_ideas" ADD CONSTRAINT "story_ideas_universe_id_story_groups_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."story_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");