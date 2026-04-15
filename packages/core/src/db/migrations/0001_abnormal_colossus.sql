CREATE TABLE "story_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"system_prompt" text NOT NULL,
	"agent_overrides" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "group_id" integer;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_group_id_story_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."story_groups"("id") ON DELETE no action ON UPDATE no action;