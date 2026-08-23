CREATE TABLE "group_study_blocks" (
	"blocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"blocked_by_user_id" uuid NOT NULL,
	"group_session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "group_study_blocks_group_session_id_user_id_pk" PRIMARY KEY("group_session_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "group_study_activities" DROP CONSTRAINT "group_study_activities_action_check";--> statement-breakpoint
ALTER TABLE "group_study_sessions" ADD COLUMN "join_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "group_study_sessions" ADD COLUMN "name" varchar(80) DEFAULT 'Focus room' NOT NULL;--> statement-breakpoint
ALTER TABLE "group_study_sessions" ADD COLUMN "participant_limit" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "group_study_blocks" ADD CONSTRAINT "group_study_blocks_blocked_by_user_id_users_id_fk" FOREIGN KEY ("blocked_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_study_blocks" ADD CONSTRAINT "group_study_blocks_group_session_id_group_study_sessions_id_fk" FOREIGN KEY ("group_session_id") REFERENCES "public"."group_study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_study_blocks" ADD CONSTRAINT "group_study_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_study_blocks_user_idx" ON "group_study_blocks" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "group_study_activities" ADD CONSTRAINT "group_study_activities_action_check" CHECK ("group_study_activities"."action" in ('joined', 'paused', 'resumed', 'left', 'removed', 'blocked'));--> statement-breakpoint
ALTER TABLE "group_study_sessions" ADD CONSTRAINT "group_study_sessions_participant_limit_check" CHECK ("group_study_sessions"."participant_limit" between 2 and 20);