CREATE TABLE "story_fragments" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"fragment_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "story_fragments_story_fragment_unique" UNIQUE("story_id","fragment_id")
);
--> statement-breakpoint
ALTER TABLE "stories" DROP CONSTRAINT "stories_used_fragment_id_fragments_id_fk";
--> statement-breakpoint
ALTER TABLE "story_fragments" ADD CONSTRAINT "story_fragments_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_fragments" ADD CONSTRAINT "story_fragments_fragment_id_fragments_id_fk" FOREIGN KEY ("fragment_id") REFERENCES "public"."fragments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" DROP COLUMN "used_fragment_id";