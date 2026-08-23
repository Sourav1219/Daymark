CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"event_type" varchar(32) NOT NULL,
	"subject_type" varchar(24) DEFAULT 'quest' NOT NULL,
	"subject_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"idempotency_key" varchar(220) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_events_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "activity_events_event_type_check" CHECK ("activity_events"."event_type" in ('quest_completed', 'quest_reopened', 'quest_deleted', 'quest_restored')),
	CONSTRAINT "activity_events_subject_type_check" CHECK ("activity_events"."subject_type" = 'quest')
);
--> statement-breakpoint
CREATE TABLE "user_progression" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"experience_points" integer DEFAULT 0 NOT NULL,
	"hunter_level" integer DEFAULT 1 NOT NULL,
	"hunter_rank" varchar(1) DEFAULT 'E' NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"best_streak" integer DEFAULT 0 NOT NULL,
	"last_cleared_local_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "user_progression_xp_check" CHECK ("user_progression"."experience_points" between 0 and 2000000000),
	CONSTRAINT "user_progression_rank_check" CHECK ("user_progression"."hunter_rank" in ('E', 'D', 'C', 'B', 'A', 'S')),
	CONSTRAINT "user_progression_level_check" CHECK ("user_progression"."hunter_level" between 1 and 6),
	CONSTRAINT "user_progression_streak_check" CHECK ("user_progression"."current_streak" >= 0 and "user_progression"."best_streak" >= "user_progression"."current_streak"),
	CONSTRAINT "user_progression_version_check" CHECK ("user_progression"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "xp_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_event_id" uuid NOT NULL,
	"quest_id" uuid NOT NULL,
	"xp_delta" integer NOT NULL,
	"reason" varchar(32) NOT NULL,
	"earned_for_local_date" date NOT NULL,
	"reverses_ledger_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xp_ledger_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "xp_ledger_delta_check" CHECK ("xp_ledger"."xp_delta" between -50 and 50 and "xp_ledger"."xp_delta" <> 0),
	CONSTRAINT "xp_ledger_reason_check" CHECK ("xp_ledger"."reason" in ('quest_completion', 'quest_reopen_reversal', 'quest_delete_reversal', 'quest_restore'))
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progression" ADD CONSTRAINT "user_progression_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progression" ADD CONSTRAINT "user_progression_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_activity_event_workspace_fk" FOREIGN KEY ("activity_event_id","workspace_id") REFERENCES "public"."activity_events"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_quest_workspace_fk" FOREIGN KEY ("quest_id","workspace_id") REFERENCES "public"."tasks"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_reversal_workspace_fk" FOREIGN KEY ("reverses_ledger_entry_id","workspace_id") REFERENCES "public"."xp_ledger"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_events_workspace_idempotency_unique" ON "activity_events" USING btree ("workspace_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "activity_events_workspace_occurred_idx" ON "activity_events" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "activity_events_workspace_subject_idx" ON "activity_events" USING btree ("workspace_id","subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_progression_workspace_user_unique" ON "user_progression" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "user_progression_user_idx" ON "user_progression" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "xp_ledger_activity_event_unique" ON "xp_ledger" USING btree ("activity_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "xp_ledger_reversal_unique" ON "xp_ledger" USING btree ("reverses_ledger_entry_id") WHERE "xp_ledger"."reverses_ledger_entry_id" is not null;--> statement-breakpoint
CREATE INDEX "xp_ledger_user_date_idx" ON "xp_ledger" USING btree ("workspace_id","user_id","earned_for_local_date");--> statement-breakpoint
CREATE INDEX "xp_ledger_quest_idx" ON "xp_ledger" USING btree ("workspace_id","quest_id");