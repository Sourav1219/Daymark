# 008 — Staged PostgreSQL row-level security

Status: accepted locally 2026-08-23.

## Context

The audit recommended row-level security as defense in depth for
workspace-owned tables. Application-layer `AccessContext` predicates are the
primary tenant boundary, but a repository bug or future query that forgets the
predicate would otherwise expose cross-workspace rows with no database-level
backstop.

Daymark runs one pooled postgres.js client (`max: 5`) shared across requests,
and server reads execute as single auto-commit statements outside explicit
transactions. PostgreSQL custom settings set with `set_config(..., true)` are
transaction-local; there is no safe per-request connection pinning on this
pool. Enabling RLS before every access path stamps context would therefore
break all server-rendered reads (they would match zero rows).

## Decision

1. Introduce transaction-local context stamping now:
   - `withTenantContext` in `src/db/client.ts` for multi-step services.
   - `withWorkspaceMutation` stamps `app.user_id` / `app.workspace_id` at the
     start of every Quest mutation transaction.
2. Ship the policy DDL as `drizzle/rls-policies.staged.sql`, deliberately not
   part of the migration journal. It keys policies on
   `nullif(current_setting('app.workspace_id', true), '')::uuid`.
3. Activation is an explicit release gated on: all repositories (reads and
   writes) run inside stamped transactions; Better Auth adapter, cron sweeps,
   and retention jobs either stamp context or run under a `BYPASSRLS`
   migration role; integration tests pass with policies enforced.
4. Group study tables need participation-based policies (join codes span
   workspaces by design) and are excluded until designed.

## Consequences

- The mechanism and its proof (transaction-local visibility, commit/rollback
  reset) exist today and are covered by
  `src/db/tenant-context.integration.test.ts`.
- No runtime behavior changes until activation; the staged SQL cannot be
  applied accidentally because it is outside `drizzle/meta`.
- Future code that touches the database without context will keep working
  until activation day, which is why the gate requires full conversion first —
  the tests then turn any forgotten path into a loud failure.
