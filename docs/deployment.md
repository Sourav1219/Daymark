# Deployment, migrations, and rollback

Target: one Vercel-compatible Next.js deployment using the Node.js runtime and a Neon PostgreSQL database. The application builds without external credentials; runtime capabilities validate configuration lazily.

## Environments

| Environment | Application                          | Database                                                               | Purpose                             |
| ----------- | ------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------- |
| Local       | `pnpm dev` on Node 24                | developer-specific Neon branch/local compatible PostgreSQL when needed | implementation and focused tests    |
| Preview     | immutable Vercel preview             | per-branch/ephemeral Neon branch                                       | migration, integration, QA, and E2E |
| Production  | promoted immutable Vercel deployment | production Neon project with pooling/backups                           | user traffic                        |

Preview must not share production credentials or data. Environment variables are scoped separately in Vercel. `NEXT_PUBLIC_*` values are treated as public; all other secrets remain server-only.

## Required runtime configuration

| Variable                 | Scope                  | Purpose                                                                                                           |
| ------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | server                 | Pooled TLS connection for the least-privilege application role; production requires `sslmode=require` or stricter |
| `MIGRATION_DATABASE_URL` | release job only       | TLS connection for a distinct migration role; never expose it to application instances                            |
| `BETTER_AUTH_SECRET`     | server secret          | Session/token signing; at least 32 random characters                                                              |
| `BETTER_AUTH_URL`        | server                 | Canonical authentication origin                                                                                   |
| `CRON_SECRET`            | server secret          | Authenticates reminder and abandoned-attachment cleanup jobs; minimum 32 characters                               |
| `READINESS_SECRET`       | optional server secret | Enables the internal `/api/ready` database probe; requests must use `Authorization: Bearer <secret>`              |
| `RESEND_API_KEY`         | optional secret        | Enables the replaceable Resend email delivery adapter                                                             |
| `REMINDER_FROM_EMAIL`    | optional server        | Verified sender used with `RESEND_API_KEY`; both are required to enable email delivery                            |
| `R2_ACCOUNT_ID`          | optional server        | Cloudflare account that owns the private attachment bucket                                                        |
| `R2_ACCESS_KEY_ID`       | optional secret        | Bucket-scoped R2 S3-compatible access-key ID                                                                      |
| `R2_SECRET_ACCESS_KEY`   | optional secret        | Bucket-scoped R2 S3-compatible secret                                                                             |
| `R2_BUCKET_NAME`         | optional server        | Private attachment bucket; all four `R2_*` values are required to enable the attachment feature                   |

The public landing and liveness handler do not read these variables. Authentication and protected workspace capabilities do. Runtime services use a lazy Zod-validated accessor so missing/malformed values fail at the capability boundary with server-side diagnostics, not during a database-free production build. The runtime driver uses `prepare: false` for pooled Neon compatibility and caps each application instance at five connections.

## Build and release sequence

1. Pin Node 24 and enable Corepack; verify the committed `packageManager` version.
2. `pnpm install --frozen-lockfile`.
3. Run format, lint, strict typecheck, unit/component, and relevant integration tests.
4. Create/apply an isolated database from committed migrations and test upgrade compatibility.
5. Run `pnpm build` without relying on database access.
6. Back up/confirm PITR for production before a schema-changing release.
7. Run `pnpm db:migrate` exactly once from a controlled release job with `MIGRATION_DATABASE_URL`. Do not expose that credential to application instances or run migrations concurrently in every serverless instance.
8. Deploy/promote application code compatible with the resulting schema.
9. Run health and critical Playwright smoke checks; monitor errors, auth, latency, reminder backlog, and database health.
10. Run the production-only PWA journey over HTTPS (localhost is permitted locally), inspect manifest/installability, then exercise offline reload, replay, conflict, update, and logout clearing.

Vercel build commands do not mutate the production database. A migration failure blocks promotion.

## Migration strategy

Drizzle table declarations are the source model and `drizzle-kit generate` produces reviewable SQL/snapshots in `drizzle/`. Every database pull request contains:

- Drizzle declaration changes.
- Generated SQL and snapshot.
- Data backfill or compatibility code when needed.
- Index/lock/row-count impact analysis.
- Repository/integration tests on a clean database and an upgraded database.
- Rollback or roll-forward instructions.

Production uses `drizzle-kit migrate`; `drizzle-kit push` and automatic schema pushes are prohibited.

Use expand/contract for destructive or large changes:

1. **Expand:** add nullable columns/tables/indexes without breaking the old application. Create large indexes concurrently via a reviewed custom migration when required.
2. **Dual compatibility:** deploy code that reads/writes both shapes or tolerates either; backfill in bounded, restartable, observable batches.
3. **Switch:** verify completeness and deploy reads from the new shape.
4. **Contract:** remove old fields/constraints only in a later release after the rollback window.

Transactions should remain short. Migration review must account for table locks, default rewrites, unique validation, foreign-key validation, and serverless connection limits.

## Rollback and recovery

Application rollback and database rollback are separate decisions. Reverting a Vercel deployment does not revert PostgreSQL.

- Prefer forward fixes for additive migrations.
- Keep the prior application compatible during the expand/contract window so traffic can be rolled back safely.
- Do not write automatic destructive down migrations. A reverse migration is reviewed and tested like a forward migration.
- For irreversible data corruption or destructive DDL, stop writes if necessary, restore/fork from Neon PITR, validate, and intentionally repoint/redeploy.
- Background jobs and webhooks remain idempotent across deploy rollback; old and new versions must not double-deliver.
- Record the deployed application commit and migration ledger version in release metadata.

## Health and operations

`GET /api/health` is an uncached liveness endpoint and deliberately avoids the database. This lets Vercel distinguish a running process from dependency diagnostics. If readiness is operationally required later, add a protected endpoint with strict timeout/redaction instead of making public liveness depend on Neon.

Logs are structured and redact secrets, tokens, emails, Quest content, storage URLs, and raw provider/database errors. Alerts cover migration failures, auth anomalies, authorization spikes, elevated errors/latency, exhausted Neon connections, stalled reminders, invalid webhook signatures, and orphaned attachment work.

The committed `vercel.json` invokes `GET /api/cron/reminders` and `GET /api/cron/overdue-tasks` every five minutes, `GET /api/cron/attachments`, `GET /api/cron/stale-timers`, and `GET /api/cron/stale-rooms` hourly or faster as configured. Vercel sends `Authorization: Bearer $CRON_SECRET`; every handler accepts the shared secret, plus an optional per-job secret in addition for schedulers that can set custom headers (a per-job secret never replaces the shared one, because native Vercel jobs can only send `$CRON_SECRET`). All handlers also accept authenticated POST for test or alternate schedulers. Reminder work uses bounded claims and a ten-minute recovery lease. Attachment cleanup removes expired pending staging uploads and retries stalled deletes in bounded batches. A one-day R2 lifecycle rule on `staging/` is recommended as storage-side defense in depth.

Keep the R2 bucket private and use an exact-origin CORS policy that permits browser `PUT` requests. Start from [`r2-cors.example.json`](r2-cors.example.json), replacing the example origin. The token must be scoped to only this bucket with object read/write permission; do not define any `NEXT_PUBLIC_R2_*` variables.

The production build also emits `/serwist/sw.js`. It must be served with JavaScript content type, root `Service-Worker-Allowed`, and no-cache headers so updates are checked. The manifest and install assets are public; authenticated pages and APIs must retain private/no-store behavior. Increment the worker cache version and IndexedDB schema version intentionally when their formats change, and verify upgrade from the previous deployed version before promotion.

## Pre-deploy verification checklist

Run these gates on a disposable database and the assembled preview before
promoting. The first three are automated in CI; the rest require live
infrastructure and are executed manually as part of release.

1. **Backup/restore drill** — `pnpm backup:check` against a scratch copy of
   the production-shaped database. Dumps, wipes, restores, and compares exact
   per-table row counts.
2. **Cron delivery** — `e2e/cron-delivery.spec.ts` (part of `pnpm test:e2e`
   when `CRON_SECRET` is set) exercises reminders, retention, and overdue
   sweeps with the shared bearer secret and rejects unauthenticated calls.
3. **Smoke checks** — `BASE_URL=<preview> pnpm smoke` verifies health,
   manifest, sign-in render, protected-route redirect, and (with
   `READINESS_SECRET`) the `/api/ready` probe. CI runs it automatically when
   `SMOKE_BASE_URL` is configured.
4. **Load sanity** — exercise the five-minute cron cadence at expected task
   volume; confirm reminder claims stay bounded and durations remain under
   the function limit.
5. **Real attachment upload drill** — configure the production R2 bucket and
   token, then upload, download, delete, and confirm staging cleanup removes
   abandoned uploads.
6. **Failure recovery** — kill the deployment mid-cron and confirm the next
   invocation recovers claimed reminders via the ten-minute lease without
   double delivery.

## External verification remaining

No Vercel project, Neon branch, Resend account, R2 bucket, or production credentials were supplied or needed. Phase 10 is verified with local production output, disposable PostgreSQL, browser offline emulation, fake reminder delivery, and an interface-backed attachment store. Preview/production environment binding, real-device install/splash checks, a real Neon pooled connection, verified Resend sender, real private R2 bucket/token/CORS/lifecycle configuration, cron invocation, backlog alerting, backup/PITR, migration-role permissions, and promotion/rollback drills remain external release gates.
