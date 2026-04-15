CREATE TABLE "plan_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plan_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer,
	"question_text" text NOT NULL,
	"answer_text" text,
	"created_at" timestamp DEFAULT now(),
	"answered_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "plan_conversations" ADD CONSTRAINT "plan_conversations_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_questions" ADD CONSTRAINT "plan_questions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;