CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"universe_id" integer,
	"embedding" vector(1536) NOT NULL,
	"content_hash" text NOT NULL,
	"embedding_model" text DEFAULT 'openai/text-embedding-3-small' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "story_embeddings_story_id_unique" UNIQUE("story_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "story_embeddings" ADD CONSTRAINT "story_embeddings_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "story_embeddings" ADD CONSTRAINT "story_embeddings_universe_id_story_groups_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."story_groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_embeddings_universe_idx" ON "story_embeddings" USING btree ("universe_id");
