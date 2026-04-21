CREATE TABLE "child_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"enjoyed" integer,
	"was_funny" boolean,
	"was_scary" boolean,
	"too_long" boolean,
	"understood_moral" boolean,
	"want_again" boolean,
	"favorite_moment" text,
	"favorite_character" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "child_reactions_story_id_unique" UNIQUE("story_id")
);
--> statement-breakpoint
CREATE TABLE "parent_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"rating" integer,
	"pacing_ok" boolean,
	"would_reuse" boolean,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "parent_reviews_story_id_unique" UNIQUE("story_id")
);
--> statement-breakpoint
ALTER TABLE "child_reactions" ADD CONSTRAINT "child_reactions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_reviews" ADD CONSTRAINT "parent_reviews_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;