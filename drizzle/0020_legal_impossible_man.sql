DROP INDEX "group_study_sessions_host_created_idx";--> statement-breakpoint
DROP INDEX "group_study_sessions_ended_idx";--> statement-breakpoint
ALTER TABLE "group_study_sessions" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
UPDATE "group_study_sessions" AS "room"
SET "workspace_id" = "host_timer"."workspace_id"
FROM (
	SELECT DISTINCT ON ("participant"."group_session_id")
		"participant"."group_session_id",
		"timer"."workspace_id"
	FROM "group_study_participants" AS "participant"
	INNER JOIN "timer_sessions" AS "timer"
		ON "timer"."id" = "participant"."timer_session_id"
	INNER JOIN "group_study_sessions" AS "candidate"
		ON "candidate"."id" = "participant"."group_session_id"
	WHERE "participant"."user_id" = "candidate"."host_user_id"
	ORDER BY "participant"."group_session_id", "participant"."joined_at"
) AS "host_timer"
WHERE "room"."id" = "host_timer"."group_session_id";--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM "group_study_sessions" WHERE "workspace_id" IS NULL
	) THEN
		RAISE EXCEPTION 'Cannot infer workspace for an existing Group Study session';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "group_study_sessions" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "group_study_sessions" ADD CONSTRAINT "group_study_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_study_sessions_workspace_status_idx" ON "group_study_sessions" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "group_study_sessions_host_created_idx" ON "group_study_sessions" USING btree ("workspace_id","host_user_id","created_at");--> statement-breakpoint
CREATE INDEX "group_study_sessions_ended_idx" ON "group_study_sessions" USING btree ("workspace_id","host_user_id","ended_at");
