ALTER TABLE "timer_sessions" DROP CONSTRAINT "timer_sessions_quest_workspace_fk";
--> statement-breakpoint
DROP INDEX "timer_sessions_quest_id_idx";--> statement-breakpoint
ALTER TABLE "timer_sessions" DROP COLUMN "quest_id";