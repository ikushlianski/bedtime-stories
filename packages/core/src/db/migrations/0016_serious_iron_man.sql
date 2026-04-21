CREATE TABLE "story_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "story_readings" ADD CONSTRAINT "story_readings_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;