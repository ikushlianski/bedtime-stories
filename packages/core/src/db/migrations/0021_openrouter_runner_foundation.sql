CREATE TABLE "model_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer,
	"stage" text NOT NULL,
	"model_id" text,
	"attempt" integer DEFAULT 1 NOT NULL,
	"fallback_used" boolean DEFAULT false NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"usd" numeric DEFAULT '0' NOT NULL,
	"latency_ms" integer,
	"success" boolean NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "model_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"input_usd_per_million" numeric,
	"output_usd_per_million" numeric,
	"context_length" integer,
	"supports_json_schema" boolean DEFAULT false,
	"is_free" boolean DEFAULT false,
	"is_recommended_for_prose" boolean DEFAULT false,
	"last_synced_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_model_id_model_catalog_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."model_catalog"("id") ON DELETE no action ON UPDATE no action;