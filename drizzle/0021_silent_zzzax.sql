ALTER TABLE "tasks" ADD COLUMN "purged_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "tasks_workspace_purged_at_idx" ON "tasks" USING btree ("workspace_id","purged_at");