ALTER TABLE "users" ADD COLUMN "age_requirement_version" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "age_confirmed_at" timestamp with time zone;