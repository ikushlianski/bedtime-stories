CREATE TABLE "child_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"age" integer,
	"activities" text,
	"interests" text,
	"dislikes" text,
	"favourites" text,
	"notes" text,
	"updated_at" timestamp DEFAULT now()
);
