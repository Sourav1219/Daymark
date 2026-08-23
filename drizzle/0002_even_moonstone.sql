CREATE TABLE "gates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"accent_token" varchar(32) DEFAULT 'system-blue' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "gates_position_check" CHECK ("gates"."position" >= 0),
	CONSTRAINT "gates_version_check" CHECK ("gates"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"name" varchar(60) NOT NULL,
	"color_token" varchar(32) DEFAULT 'system-blue' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "labels_version_check" CHECK ("labels"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "quest_labels" (
	"workspace_id" uuid NOT NULL,
	"quest_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quest_labels_quest_id_label_id_pk" PRIMARY KEY("quest_id","label_id")
);
--> statement-breakpoint
ALTER TABLE "gates" ADD CONSTRAINT "gates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gates" ADD CONSTRAINT "gates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_labels" ADD CONSTRAINT "quest_labels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_labels" ADD CONSTRAINT "quest_labels_quest_id_tasks_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_labels" ADD CONSTRAINT "quest_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_labels" ADD CONSTRAINT "quest_labels_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gates_workspace_name_unique" ON "gates" USING btree (lower("name"),"workspace_id") WHERE "gates"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "gates_workspace_lifecycle_idx" ON "gates" USING btree ("workspace_id","archived_at","deleted_at","position");--> statement-breakpoint
CREATE INDEX "gates_creator_idx" ON "gates" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "labels_workspace_name_unique" ON "labels" USING btree (lower("name"),"workspace_id") WHERE "labels"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "labels_workspace_id_idx" ON "labels" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "quest_labels_workspace_label_idx" ON "quest_labels" USING btree ("workspace_id","label_id");--> statement-breakpoint
CREATE INDEX "quest_labels_quest_idx" ON "quest_labels" USING btree ("quest_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_gates_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."gates"("id") ON DELETE set null ON UPDATE no action;