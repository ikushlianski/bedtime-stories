ALTER TABLE "model_catalog" ADD COLUMN "description" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "model_catalog" ADD COLUMN "created_by_provider" timestamp;--> statement-breakpoint
ALTER TABLE "model_catalog" ADD COLUMN "image_usd_per_request" numeric;--> statement-breakpoint
ALTER TABLE "model_catalog" ADD COLUMN "max_output_tokens" integer;--> statement-breakpoint
ALTER TABLE "model_catalog" ADD COLUMN "modality" text DEFAULT 'text->text';--> statement-breakpoint
ALTER TABLE "model_catalog" ADD COLUMN "input_modalities" jsonb DEFAULT '["text"]'::jsonb;--> statement-breakpoint
ALTER TABLE "model_catalog" ADD COLUMN "tokenizer" text;--> statement-breakpoint
ALTER TABLE "model_catalog" ADD COLUMN "instruct_type" text;--> statement-breakpoint
ALTER TABLE "model_catalog" ADD COLUMN "is_moderated" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "model_catalog" ADD COLUMN "expiration_date" text;