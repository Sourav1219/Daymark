ALTER TABLE "quest_labels" DROP CONSTRAINT "quest_labels_quest_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "quest_labels" DROP CONSTRAINT "quest_labels_label_id_labels_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_project_id_gates_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_parent_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "gates" ADD CONSTRAINT "gates_id_workspace_unique" UNIQUE("id","workspace_id");--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_id_workspace_unique" UNIQUE("id","workspace_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_id_workspace_unique" UNIQUE("id","workspace_id");--> statement-breakpoint
ALTER TABLE "quest_labels" ADD CONSTRAINT "quest_labels_quest_workspace_fk" FOREIGN KEY ("quest_id","workspace_id") REFERENCES "public"."tasks"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_labels" ADD CONSTRAINT "quest_labels_label_workspace_fk" FOREIGN KEY ("label_id","workspace_id") REFERENCES "public"."labels"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_workspace_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."gates"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_workspace_fk" FOREIGN KEY ("parent_task_id","workspace_id") REFERENCES "public"."tasks"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE INDEX "tasks_title_search_idx" ON "tasks" USING gin ("title" gin_trgm_ops) WHERE "tasks"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tasks_description_search_idx" ON "tasks" USING gin ("description" gin_trgm_ops) WHERE "tasks"."deleted_at" is null;
