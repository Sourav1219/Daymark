CREATE TABLE "group_study_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_study_join_requests_status_check" CHECK ("group_study_join_requests"."status" in ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "group_study_sessions" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "group_study_join_requests" ADD CONSTRAINT "group_study_join_requests_group_session_id_group_study_sessions_id_fk" FOREIGN KEY ("group_session_id") REFERENCES "public"."group_study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_study_join_requests" ADD CONSTRAINT "group_study_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_study_join_requests_session_idx" ON "group_study_join_requests" USING btree ("group_session_id");--> statement-breakpoint
CREATE INDEX "group_study_join_requests_user_idx" ON "group_study_join_requests" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_study_join_requests_active_unique" ON "group_study_join_requests" USING btree ("group_session_id","user_id") WHERE "group_study_join_requests"."status" = 'pending';