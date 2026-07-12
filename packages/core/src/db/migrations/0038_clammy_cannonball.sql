CREATE TABLE "story_words" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"word_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "story_words_story_word_unique" UNIQUE("story_id","word_id")
);
--> statement-breakpoint
CREATE TABLE "words" (
	"id" serial PRIMARY KEY NOT NULL,
	"word" text NOT NULL,
	"hint" text,
	"universe_id" integer,
	"rank" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "universe_characters" ADD COLUMN "age" text;--> statement-breakpoint
ALTER TABLE "universe_characters" ADD COLUMN "setting" text;--> statement-breakpoint
ALTER TABLE "universe_characters" ADD COLUMN "traits" text;--> statement-breakpoint
ALTER TABLE "universe_characters" ADD COLUMN "relationships" text;--> statement-breakpoint
ALTER TABLE "universe_characters" ADD COLUMN "co_occurrence_note" text;--> statement-breakpoint
ALTER TABLE "story_words" ADD CONSTRAINT "story_words_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_words" ADD CONSTRAINT "story_words_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "words" ADD CONSTRAINT "words_universe_id_story_groups_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."story_groups"("id") ON DELETE no action ON UPDATE no action;