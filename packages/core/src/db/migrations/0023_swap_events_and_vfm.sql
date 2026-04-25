CREATE TABLE "model_swap_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer,
	"stage" text NOT NULL,
	"from_model" text,
	"to_model" text,
	"reason_chip" text,
	"reason_text" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "value_for_money_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "value_for_money_feedback_story_id_unique" UNIQUE("story_id")
);
--> statement-breakpoint
ALTER TABLE "model_swap_events" ADD CONSTRAINT "model_swap_events_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_swap_events" ADD CONSTRAINT "model_swap_events_from_model_model_catalog_id_fk" FOREIGN KEY ("from_model") REFERENCES "public"."model_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_swap_events" ADD CONSTRAINT "model_swap_events_to_model_model_catalog_id_fk" FOREIGN KEY ("to_model") REFERENCES "public"."model_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_for_money_feedback" ADD CONSTRAINT "value_for_money_feedback_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_swap_events" ADD CONSTRAINT "model_swap_events_reason_present" CHECK ("reason_chip" IS NOT NULL OR COALESCE(length("reason_text"), 0) > 0);--> statement-breakpoint
ALTER TABLE "value_for_money_feedback" ADD CONSTRAINT "value_for_money_feedback_rating_range" CHECK ("rating" BETWEEN 1 AND 5);