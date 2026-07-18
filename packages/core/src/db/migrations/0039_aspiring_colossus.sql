CREATE TABLE "story_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"universe_id" integer,
	"comment_text" text NOT NULL,
	"selected_text" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "annotations" ALTER COLUMN "selected_text" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_conversations" ADD COLUMN "context" text DEFAULT 'plan' NOT NULL;--> statement-breakpoint
ALTER TABLE "story_comments" ADD CONSTRAINT "story_comments_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_comments" ADD CONSTRAINT "story_comments_universe_id_story_groups_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."story_groups"("id") ON DELETE no action ON UPDATE no action;