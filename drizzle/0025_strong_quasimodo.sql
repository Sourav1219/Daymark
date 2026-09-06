ALTER TABLE "tasks" ADD COLUMN "task_type" varchar(16) DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "effort" varchar(16) DEFAULT 'unset' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "type_manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "effort_manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_type_check" CHECK ("tasks"."task_type" in ('work', 'study', 'personal', 'health', 'other'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_effort_check" CHECK ("tasks"."effort" in ('unset', 'light', 'moderate', 'deep'));
--> statement-breakpoint
-- Seed suggestions for existing tasks. These rules mirror classification.ts;
-- later manual corrections are tracked separately and never inferred over.
WITH suggestions AS (
  SELECT id,
    concat(title, ' ', description) AS content,
    concat(title, ' ', description) ~* '\m(client|invoice|meeting|colleague|customer|proposal|office)\M' AS work,
    concat(title, ' ', description) ~* '\m(study|revise|revision|calculus|chapter|homework|exam|lecture|coursework)\M' AS study,
    concat(title, ' ', description) ~* '\m(buy|groceries|detergent|laundry|clean|shopping|errand)\M' AS personal,
    concat(title, ' ', description) ~* '\m(workout|exercise|gym|doctor|dentist|meditate|meditation|yoga|jog)\M' AS health
  FROM tasks
)
UPDATE tasks SET
  task_type = CASE WHEN (work::int + study::int + personal::int + health::int) = 1
    THEN CASE WHEN work THEN 'work' WHEN study THEN 'study' WHEN personal THEN 'personal' ELSE 'health' END
    ELSE 'other' END,
  effort = CASE
    WHEN content ~* '\m(revise|calculus|research|dissertation|thesis|debug|essay)\M' THEN 'deep'
    WHEN content ~* '\m(workout|exercise|meeting|clean|cook|practice)\M' THEN 'moderate'
    WHEN content ~* '\m(reply|buy|email|detergent|remind|pick up)\M' THEN 'light'
    ELSE 'unset' END
FROM suggestions WHERE tasks.id = suggestions.id;
