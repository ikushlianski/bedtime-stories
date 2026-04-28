CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"stage_models" jsonb,
	"updated_at" timestamp DEFAULT now()
);
