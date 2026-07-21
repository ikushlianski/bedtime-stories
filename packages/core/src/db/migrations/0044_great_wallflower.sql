CREATE TABLE IF NOT EXISTS "story_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"universe_id" integer,
	"sequence_index" integer NOT NULL,
	"scene_description" text NOT NULL,
	"prompt_used" text NOT NULL,
	"model_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"gcs_path" text,
	"reference_image_used" boolean DEFAULT false NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "story_images_story_sequence_unique" UNIQUE("story_id","sequence_index")
);
--> statement-breakpoint
ALTER TABLE "story_groups" ADD COLUMN IF NOT EXISTS "visual_style_guide" text;--> statement-breakpoint
ALTER TABLE "story_groups" ADD COLUMN IF NOT EXISTS "reference_image_path" text;--> statement-breakpoint
ALTER TABLE "universe_characters" ADD COLUMN IF NOT EXISTS "visual_description" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "story_images" ADD CONSTRAINT "story_images_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "story_images" ADD CONSTRAINT "story_images_universe_id_story_groups_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."story_groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "story_images" ADD CONSTRAINT "story_images_model_id_model_catalog_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."model_catalog"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
