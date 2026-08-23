ALTER TABLE "tasks" DROP CONSTRAINT "tasks_status_check";--> statement-breakpoint
ALTER TABLE "activity_events" DROP CONSTRAINT "activity_events_event_type_check";--> statement-breakpoint
ALTER TABLE "xp_ledger" DROP CONSTRAINT "xp_ledger_delta_check";--> statement-breakpoint
ALTER TABLE "xp_ledger" DROP CONSTRAINT "xp_ledger_reason_check";--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_check" CHECK ("tasks"."status" in ('open', 'completed', 'failed'));--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_event_type_check" CHECK ("activity_events"."event_type" in ('quest_completed', 'quest_reopened', 'quest_deleted', 'quest_restored', 'quest_failed'));--> statement-breakpoint
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_delta_check" CHECK ("xp_ledger"."xp_delta" between -500 and 50 and "xp_ledger"."xp_delta" <> 0);--> statement-breakpoint
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_reason_check" CHECK ("xp_ledger"."reason" in ('quest_completion', 'quest_reopen_reversal', 'quest_delete_reversal', 'quest_restore', 'quest_failure_penalty'));