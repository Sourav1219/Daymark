CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"quest_id" uuid NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"display_name" varchar(160) DEFAULT 'Pending attachment' NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"requested_content_type" varchar(128) NOT NULL,
	"content_type" varchar(128),
	"expected_byte_size" integer NOT NULL,
	"byte_size" integer,
	"upload_expires_at" timestamp with time zone NOT NULL,
	"ready_at" timestamp with time zone,
	"failure_code" varchar(48),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "attachments_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "attachments_status_check" CHECK ("attachments"."status" in ('pending', 'ready', 'deleting', 'deleted', 'failed')),
	CONSTRAINT "attachments_requested_content_type_check" CHECK ("attachments"."requested_content_type" in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "attachments_content_type_check" CHECK ("attachments"."content_type" is null or "attachments"."content_type" in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "attachments_expected_size_check" CHECK ("attachments"."expected_byte_size" between 1 and 10485760),
	CONSTRAINT "attachments_size_check" CHECK ("attachments"."byte_size" is null or "attachments"."byte_size" between 1 and 10485760),
	CONSTRAINT "attachments_version_check" CHECK ("attachments"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_quest_workspace_fk" FOREIGN KEY ("quest_id","workspace_id") REFERENCES "public"."tasks"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_storage_key_unique" ON "attachments" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "attachments_workspace_quest_idx" ON "attachments" USING btree ("workspace_id","quest_id","deleted_at");--> statement-breakpoint
CREATE INDEX "attachments_pending_expiry_idx" ON "attachments" USING btree ("status","upload_expires_at") WHERE "attachments"."deleted_at" is null and "attachments"."status" in ('pending', 'deleting');