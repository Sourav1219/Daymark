ALTER TABLE "user_settings" ALTER COLUMN "timezone" SET DEFAULT 'UTC';--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "timezone" SET DEFAULT 'UTC';--> statement-breakpoint
ALTER TABLE "group_study_participants" ADD COLUMN "last_heartbeat_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "group_study_participants_user_left_idx" ON "group_study_participants" USING btree ("user_id","left_at");--> statement-breakpoint
CREATE INDEX "group_study_participants_heartbeat_idx" ON "group_study_participants" USING btree ("last_heartbeat_at");--> statement-breakpoint
CREATE INDEX "timer_sessions_user_ended_idx" ON "timer_sessions" USING btree ("workspace_id","user_id","ended_at");