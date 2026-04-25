ALTER TABLE "model_calls" ADD COLUMN "usd_micros" bigint NOT NULL DEFAULT 0;--> statement-breakpoint
UPDATE "model_calls" SET "usd_micros" = ROUND("usd" * 1000000)::bigint WHERE "usd" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "model_calls" DROP COLUMN "usd";
