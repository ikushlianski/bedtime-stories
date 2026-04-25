ALTER TABLE "model_calls" ALTER COLUMN "usd_micros" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "model_calls" ALTER COLUMN "usd_micros" DROP DEFAULT;
