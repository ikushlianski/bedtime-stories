CREATE TABLE IF NOT EXISTS "telegram_pending_actions" (
	"chat_id" bigint PRIMARY KEY NOT NULL,
	"universe_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "telegram_pending_actions" ADD CONSTRAINT "telegram_pending_actions_universe_id_story_groups_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."story_groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;