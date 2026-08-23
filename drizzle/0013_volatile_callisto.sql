CREATE TABLE "group_study_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_session_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(16) NOT NULL,
	"timer_elapsed_ms" bigint DEFAULT 0 NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_study_activities_action_check" CHECK ("group_study_activities"."action" in ('joined', 'paused', 'resumed', 'left')),
	CONSTRAINT "group_study_activities_elapsed_check" CHECK ("group_study_activities"."timer_elapsed_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "group_study_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"timer_session_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "group_study_participants_version_check" CHECK ("group_study_participants"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "group_study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_user_id" uuid NOT NULL,
	"join_code" varchar(8) NOT NULL,
	"subject" varchar(160) NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "group_study_sessions_status_check" CHECK ("group_study_sessions"."status" in ('active', 'closed')),
	CONSTRAINT "group_study_sessions_version_check" CHECK ("group_study_sessions"."version" > 0),
	CONSTRAINT "group_study_sessions_lifecycle_check" CHECK (("group_study_sessions"."status" = 'active' and "group_study_sessions"."ended_at" is null) or ("group_study_sessions"."status" = 'closed' and "group_study_sessions"."ended_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "group_study_activities" ADD CONSTRAINT "group_study_activities_group_session_id_group_study_sessions_id_fk" FOREIGN KEY ("group_session_id") REFERENCES "public"."group_study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_study_activities" ADD CONSTRAINT "group_study_activities_participant_id_group_study_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."group_study_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_study_activities" ADD CONSTRAINT "group_study_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_study_participants" ADD CONSTRAINT "group_study_participants_group_session_id_group_study_sessions_id_fk" FOREIGN KEY ("group_session_id") REFERENCES "public"."group_study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_study_participants" ADD CONSTRAINT "group_study_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_study_participants" ADD CONSTRAINT "group_study_participants_timer_session_id_timer_sessions_id_fk" FOREIGN KEY ("timer_session_id") REFERENCES "public"."timer_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_study_sessions" ADD CONSTRAINT "group_study_sessions_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_study_activities_session_time_idx" ON "group_study_activities" USING btree ("group_session_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "group_study_participants_timer_unique" ON "group_study_participants" USING btree ("timer_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_study_participants_user_active_unique" ON "group_study_participants" USING btree ("user_id") WHERE "group_study_participants"."left_at" is null;--> statement-breakpoint
CREATE INDEX "group_study_participants_session_active_idx" ON "group_study_participants" USING btree ("group_session_id","left_at");--> statement-breakpoint
CREATE UNIQUE INDEX "group_study_sessions_join_code_unique" ON "group_study_sessions" USING btree ("join_code");--> statement-breakpoint
CREATE INDEX "group_study_sessions_host_created_idx" ON "group_study_sessions" USING btree ("host_user_id","created_at");