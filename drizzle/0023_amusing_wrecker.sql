ALTER TABLE "push_subscriptions" ADD COLUMN "consecutive_failure_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "last_failure_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_failure_count_check" CHECK ("push_subscriptions"."consecutive_failure_count" >= 0);