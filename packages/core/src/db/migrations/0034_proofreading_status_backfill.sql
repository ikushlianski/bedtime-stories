UPDATE "stories" SET "status" = 'proofreading' WHERE "status" = 'ready' AND "ready_at" IS NULL;
