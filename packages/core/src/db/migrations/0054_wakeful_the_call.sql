CREATE TABLE "story_characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"character_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "story_characters_story_character_unique" UNIQUE("story_id","character_id")
);
--> statement-breakpoint
ALTER TABLE "story_characters" ADD CONSTRAINT "story_characters_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_characters" ADD CONSTRAINT "story_characters_character_id_universe_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."universe_characters"("id") ON DELETE no action ON UPDATE no action;