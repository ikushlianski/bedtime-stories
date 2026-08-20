CREATE TABLE "character_portraits" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"storage_path" text NOT NULL,
	"tier" text NOT NULL,
	"source_storage_paths" jsonb DEFAULT 'null'::jsonb,
	"is_current" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "character_reference_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"storage_path" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "model_calls" ADD COLUMN "character_id" integer;--> statement-breakpoint
ALTER TABLE "character_portraits" ADD CONSTRAINT "character_portraits_character_id_universe_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."universe_characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_reference_images" ADD CONSTRAINT "character_reference_images_character_id_universe_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."universe_characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_character_id_universe_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."universe_characters"("id") ON DELETE no action ON UPDATE no action;