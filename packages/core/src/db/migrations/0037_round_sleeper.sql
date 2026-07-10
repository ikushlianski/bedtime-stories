CREATE TABLE "story_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "story_topics_story_topic_unique" UNIQUE("story_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"universe_id" integer,
	"rank" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "story_topics" ADD CONSTRAINT "story_topics_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_topics" ADD CONSTRAINT "story_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_universe_id_story_groups_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."story_groups"("id") ON DELETE no action ON UPDATE no action;