CREATE TABLE "universe_characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"universe_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "universe_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"universe_id" integer NOT NULL,
	"fact_text" text NOT NULL,
	"source_story_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "story_groups" ADD COLUMN "style_guide_works" text;--> statement-breakpoint
ALTER TABLE "story_groups" ADD COLUMN "style_guide_doesnt_work" text;--> statement-breakpoint
ALTER TABLE "story_groups" ADD COLUMN "style_guide_techniques" text;--> statement-breakpoint
ALTER TABLE "story_groups" ADD COLUMN "style_guide_minimize" text;--> statement-breakpoint
ALTER TABLE "universe_characters" ADD CONSTRAINT "universe_characters_universe_id_story_groups_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."story_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universe_suggestions" ADD CONSTRAINT "universe_suggestions_universe_id_story_groups_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."story_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universe_suggestions" ADD CONSTRAINT "universe_suggestions_source_story_id_stories_id_fk" FOREIGN KEY ("source_story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;