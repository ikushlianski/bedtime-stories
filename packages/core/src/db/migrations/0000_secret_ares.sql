CREATE TABLE "annotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer,
	"type" text NOT NULL,
	"selected_text" text NOT NULL,
	"position_start" integer,
	"position_end" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer,
	"rating" integer,
	"comment" text,
	"feedback_type" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent" text,
	"version" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"change_reason" text,
	"source_feedbacks" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "run_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer,
	"plotter_model" text,
	"plotter_prompt_version" integer,
	"psychologist_plan_model" text,
	"psychologist_plan_prompt_version" integer,
	"plot_critic_model" text,
	"plot_critic_prompt_version" integer,
	"writer_model" text,
	"writer_prompt_version" integer,
	"psychologist_text_model" text,
	"psychologist_text_prompt_version" integer,
	"writer_critic_model" text,
	"writer_critic_prompt_version" integer,
	"plan_iterations_count" integer,
	"plan_v1" text,
	"plan_final" text,
	"psychologist_plan_output" jsonb,
	"plot_critic_output" jsonb,
	"text_v1" text,
	"text_v2" text,
	"psychologist_text_output" jsonb,
	"writer_critic_output" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"text_final" text,
	"plan_v1" text,
	"plan_final" text,
	"plan_iterations" integer DEFAULT 1,
	"text_v1" text,
	"text_v2" text,
	"plotter_model" text,
	"plotter_prompt_version" integer,
	"plot_critic_model" text,
	"plot_critic_prompt_version" integer,
	"writer_model" text,
	"writer_prompt_version" integer,
	"writer_critic_model" text,
	"writer_critic_prompt_version" integer,
	"created_at" timestamp DEFAULT now(),
	"status" text DEFAULT 'draft',
	"tags" jsonb DEFAULT '[]'::jsonb,
	"source" text DEFAULT 'agent',
	"is_legacy" boolean DEFAULT false,
	"discussion_questions" jsonb DEFAULT '[]'::jsonb,
	"seed" text
);
--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_snapshots" ADD CONSTRAINT "run_snapshots_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;