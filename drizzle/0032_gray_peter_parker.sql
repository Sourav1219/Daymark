CREATE TABLE "privacy_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" varchar(32) NOT NULL,
	"user_id" uuid,
	"requester_email" varchar(320) NOT NULL,
	"type" varchar(32) NOT NULL,
	"details" text NOT NULL,
	"status" varchar(16) DEFAULT 'submitted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "privacy_requests_type_check" CHECK ("privacy_requests"."type" in ('access', 'correction', 'erasure', 'portability', 'objection', 'grievance')),
	CONSTRAINT "privacy_requests_status_check" CHECK ("privacy_requests"."status" in ('submitted', 'review', 'completed'))
);
--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "privacy_requests_ticket_unique" ON "privacy_requests" USING btree ("ticket_number");--> statement-breakpoint
CREATE INDEX "privacy_requests_user_created_idx" ON "privacy_requests" USING btree ("user_id","created_at");