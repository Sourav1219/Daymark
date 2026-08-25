-- Traketo staged row-level security policies (defense in depth).
--
-- STATUS: NOT APPLIED BY THIS MIGRATION SET. Applying these statements is an
-- explicit, coordinated release step that requires EVERY database access path
-- to stamp `app.user_id` / `app.workspace_id` first (see withTenantContext in
-- src/db/client.ts and withWorkspaceMutation in the quest mutation service).
-- Enabling RLS while pooled, non-transactional reads still run without
-- context would make every server-rendered read return zero rows.
--
-- Rollout gate (all must hold before applying):
-- 1. Every repository entry point runs inside withTenantContext (reads and
--    writes). Better Auth adapter calls, cron sweeps, and the retention job
--    either stamp a context or run as the migration role with BYPASSRLS.
-- 2. The runtime role (DATABASE_URL) is not the table owner, so policies
--    bind it. The migration role keeps ownership and gets BYPASSRLS.
-- 3. Integration tests pass with policies enforced (they run as the runtime
--    role, so any un-stamped path fails loudly).
--
-- Policy semantics: a row is visible only when the transaction-local
-- workspace matches the row's workspace. nullif guards the empty-string
-- state a committed LOCAL GUC leaves behind.

-- Apply per tenant-owned table (tasks shown; repeat for gates, labels,
-- quest_labels, reminders, reminder_deliveries, in_app_notifications,
-- attachments, timer_sessions, group_study_sessions, group_study_participants,
-- group_study_activities, group_study_join_requests, activity_events,
-- xp_ledger, user_progression):
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tasks;
CREATE POLICY tenant_isolation ON tasks
  USING (
    workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid
  )
  WITH CHECK (
    workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid
  );

-- User-scoped tables (push_subscriptions, user_settings, user_progression)
-- key on the user instead:
--   user_id = nullif(current_setting('app.user_id', true), '')::uuid

-- Group study rooms intentionally span workspaces through join codes; their
-- policies key on participation rather than a single workspace and need a
-- dedicated design before activation.
