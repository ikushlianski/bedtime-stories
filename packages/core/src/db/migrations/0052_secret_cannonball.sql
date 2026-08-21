CREATE TABLE "story_illustration_markers" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"marked_text" text NOT NULL,
	"position_start" integer NOT NULL,
	"position_end" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "story_illustrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"storage_path" text NOT NULL,
	"moment_description" text NOT NULL,
	"source" text NOT NULL,
	"character_ids" jsonb DEFAULT 'null'::jsonb,
	"order_index" integer NOT NULL,
	"generated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "story_illustration_markers" ADD CONSTRAINT "story_illustration_markers_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_illustrations" ADD CONSTRAINT "story_illustrations_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;