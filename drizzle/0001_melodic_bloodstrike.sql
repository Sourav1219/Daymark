CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"project_id" uuid,
	"parent_task_id" uuid,
	"title" varchar(160) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"priority" varchar(16) DEFAULT 'medium' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"start_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"recurrence_rule" text,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tasks_status_check" CHECK ("tasks"."status" in ('open', 'completed')),
	CONSTRAINT "tasks_priority_check" CHECK ("tasks"."priority" in ('low', 'medium', 'high', 'critical')),
	CONSTRAINT "tasks_position_check" CHECK ("tasks"."position" >= 0),
	CONSTRAINT "tasks_xp_reward_check" CHECK ("tasks"."xp_reward" >= 0),
	CONSTRAINT "tasks_version_check" CHECK ("tasks"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_workspace_status_idx" ON "tasks" USING btree ("workspace_id","status") WHERE "tasks"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tasks_workspace_due_at_idx" ON "tasks" USING btree ("workspace_id","due_at") WHERE "tasks"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tasks_workspace_position_idx" ON "tasks" USING btree ("workspace_id","position") WHERE "tasks"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tasks_workspace_deleted_at_idx" ON "tasks" USING btree ("workspace_id","deleted_at");--> statement-breakpoint
CREATE INDEX "tasks_project_id_idx" ON "tasks" USING btree ("project_id") WHERE "tasks"."project_id" is not null;--> statement-breakpoint
CREATE INDEX "tasks_parent_task_id_idx" ON "tasks" USING btree ("parent_task_id") WHERE "tasks"."parent_task_id" is not null;