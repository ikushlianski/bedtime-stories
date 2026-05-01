CREATE TABLE "story_text_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"text" text NOT NULL,
	"model_id" text,
	"stage" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "active_text_version_id" integer;--> statement-breakpoint
ALTER TABLE "story_text_versions" ADD CONSTRAINT "story_text_versions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;