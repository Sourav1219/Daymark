CREATE TABLE "timer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"subject" varchar(160) NOT NULL,
	"status" varchar(16) DEFAULT 'running' NOT NULL,
	"accumulated_ms" bigint DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_started_at" timestamp with time zone DEFAULT now(),
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "timer_sessions_status_check" CHECK ("timer_sessions"."status" in ('running', 'paused', 'completed')),
	CONSTRAINT "timer_sessions_accumulated_ms_check" CHECK ("timer_sessions"."accumulated_ms" >= 0),
	CONSTRAINT "timer_sessions_version_check" CHECK ("timer_sessions"."version" > 0),
	CONSTRAINT "timer_sessions_lifecycle_check" CHECK (("timer_sessions"."status" = 'running' and "timer_sessions"."last_started_at" is not null and "timer_sessions"."ended_at" is null) or ("timer_sessions"."status" = 'paused' and "timer_sessions"."last_started_at" is null and "timer_sessions"."ended_at" is null) or ("timer_sessions"."status" = 'completed' and "timer_sessions"."last_started_at" is null and "timer_sessions"."ended_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "timer_sessions" ADD CONSTRAINT "timer_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timer_sessions" ADD CONSTRAINT "timer_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "timer_sessions_user_active_unique" ON "timer_sessions" USING btree ("workspace_id","user_id") WHERE "timer_sessions"."status" in ('running', 'paused');--> statement-breakpoint
CREATE INDEX "timer_sessions_user_started_idx" ON "timer_sessions" USING btree ("workspace_id","user_id","started_at");