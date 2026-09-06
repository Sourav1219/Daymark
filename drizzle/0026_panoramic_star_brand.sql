ALTER TABLE "tasks" ALTER COLUMN "task_type" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "task_type" SET DEFAULT 'personal';--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "effort" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "effort_manual" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "custom_type" varchar(64);