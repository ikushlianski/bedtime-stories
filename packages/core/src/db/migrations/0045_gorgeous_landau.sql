CREATE TABLE IF NOT EXISTS "character_reference_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"gcs_path" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_reference_images" ADD CONSTRAINT "character_reference_images_character_id_universe_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."universe_characters"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "story_groups" DROP COLUMN IF EXISTS "reference_image_path";
