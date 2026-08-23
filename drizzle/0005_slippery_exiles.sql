CREATE TABLE "in_app_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reminder_id" uuid NOT NULL,
	"quest_id" uuid NOT NULL,
	"kind" varchar(40) DEFAULT 'quest_reminder_due' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "in_app_notifications_kind_check" CHECK ("in_app_notifications"."kind" = 'quest_reminder_due')
);
--> statement-breakpoint
CREATE TABLE "reminder_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"reminder_id" uuid NOT NULL,
	"idempotency_key" varchar(200) NOT NULL,
	"channel" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'processing' NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"provider_message_id" varchar(160),
	"error_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	CONSTRAINT "reminder_deliveries_channel_check" CHECK ("reminder_deliveries"."channel" in ('email', 'in_app')),
	CONSTRAINT "reminder_deliveries_status_check" CHECK ("reminder_deliveries"."status" in ('processing', 'delivered', 'failed')),
	CONSTRAINT "reminder_deliveries_attempt_count_check" CHECK ("reminder_deliveries"."attempt_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"quest_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"remind_at" timestamp with time zone NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"processing_started_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"last_error_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "reminders_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "reminders_channel_check" CHECK ("reminders"."channel" in ('email', 'in_app')),
	CONSTRAINT "reminders_status_check" CHECK ("reminders"."status" in ('pending', 'processing', 'retrying', 'delivered', 'failed', 'cancelled')),
	CONSTRAINT "reminders_attempt_count_check" CHECK ("reminders"."attempt_count" >= 0),
	CONSTRAINT "reminders_max_attempts_check" CHECK ("reminders"."max_attempts" between 1 and 5),
	CONSTRAINT "reminders_version_check" CHECK ("reminders"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"email_reminders_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "user_settings_version_check" CHECK ("user_settings"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurrence_timezone" varchar(64);--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurrence_series_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurrence_occurrence_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurrence_sequence" integer;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_reminder_workspace_fk" FOREIGN KEY ("reminder_id","workspace_id") REFERENCES "public"."reminders"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_quest_workspace_fk" FOREIGN KEY ("quest_id","workspace_id") REFERENCES "public"."tasks"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_reminder_workspace_fk" FOREIGN KEY ("reminder_id","workspace_id") REFERENCES "public"."reminders"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_quest_workspace_fk" FOREIGN KEY ("quest_id","workspace_id") REFERENCES "public"."tasks"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "user_settings" ("user_id", "timezone")
SELECT "users"."id", COALESCE("workspaces"."timezone", 'UTC')
FROM "users"
LEFT JOIN "workspaces"
  ON "workspaces"."owner_user_id" = "users"."id"
  AND "workspaces"."kind" = 'personal'
  AND "workspaces"."deleted_at" IS NULL
ON CONFLICT ("user_id") DO NOTHING;--> statement-breakpoint
CREATE UNIQUE INDEX "in_app_notifications_reminder_unique" ON "in_app_notifications" USING btree ("reminder_id");--> statement-breakpoint
CREATE INDEX "in_app_notifications_user_unread_idx" ON "in_app_notifications" USING btree ("user_id","read_at") WHERE "in_app_notifications"."read_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_deliveries_idempotency_key_unique" ON "reminder_deliveries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "reminder_deliveries_reminder_id_idx" ON "reminder_deliveries" USING btree ("reminder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reminders_idempotency_key_unique" ON "reminders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "reminders_due_worker_idx" ON "reminders" USING btree ("status","next_attempt_at") WHERE "reminders"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "reminders_workspace_quest_idx" ON "reminders" USING btree ("workspace_id","quest_id");--> statement-breakpoint
CREATE INDEX "reminders_user_id_idx" ON "reminders" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_recurrence_occurrence_unique" ON "tasks" USING btree ("recurrence_series_id","recurrence_occurrence_at") WHERE "tasks"."recurrence_series_id" is not null;--> statement-breakpoint
CREATE INDEX "tasks_recurrence_series_idx" ON "tasks" USING btree ("workspace_id","recurrence_series_id") WHERE "tasks"."recurrence_series_id" is not null;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurrence_fields_check" CHECK (("tasks"."recurrence_rule" is null and "tasks"."recurrence_timezone" is null and "tasks"."recurrence_series_id" is null and "tasks"."recurrence_occurrence_at" is null and "tasks"."recurrence_sequence" is null) or ("tasks"."recurrence_rule" is not null and "tasks"."recurrence_timezone" is not null and "tasks"."recurrence_series_id" is not null and "tasks"."recurrence_occurrence_at" is not null and "tasks"."recurrence_sequence" >= 0));
