CREATE TABLE "fragments" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"universe_id" integer,
	"rank" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "used_fragment_id" integer;--> statement-breakpoint
ALTER TABLE "fragments" ADD CONSTRAINT "fragments_universe_id_story_groups_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."story_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_used_fragment_id_fragments_id_fk" FOREIGN KEY ("used_fragment_id") REFERENCES "public"."fragments"("id") ON DELETE no action ON UPDATE no action;