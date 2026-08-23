# ADR 005: Vercel deployment and reviewed Drizzle migrations

- Status: Accepted
- Date: 2026-08-08

## Context

Serverless deployments can start concurrently, while relational schema changes must happen once in a controlled order. Coupling a database push to every build/instance risks races and unreviewed destructive DDL. Application rollback also cannot automatically reverse data changes.

## Decision

Deploy one Node.js-runtime Next.js application to Vercel-compatible infrastructure and use Neon PostgreSQL through its pooled connection URL. The application uses postgres.js through Drizzle with prepared statements disabled for transaction-pool compatibility and a bounded per-instance connection count. This driver was selected in Phase 2 because personal-workspace plus owner-membership provisioning requires a real transaction; the earlier Neon HTTP placeholder did not provide interactive transactions. Builds must compile without connecting to a database. Environment variables are validated lazily at the runtime capability boundary.

Drizzle declarations are changed with generated SQL/snapshots committed under `drizzle/`. Review and test every migration on clean and upgraded disposable databases. A controlled release job runs `drizzle-kit migrate` exactly once before promotion. Never run `drizzle-kit push` in production or migrations at module import/serverless startup.

Use additive expand/contract releases for incompatible changes. Prefer forward fixes, preserve old-application compatibility through the rollback window, and rely on verified Neon backup/PITR for destructive incident recovery. Application deployment metadata records the migration ledger version.

## Consequences

- Builds/previews can run without production database access.
- Releases have an explicit migration gate and need coordination/observability.
- Destructive schema cleanup takes multiple releases but permits safe application rollback.
- Local/preview integration requires disposable Neon branches or isolated PostgreSQL databases.
- A Vercel rollback is safe only while the old application remains schema-compatible.

## Alternatives rejected

- **Schema push in production:** unreviewed drift and destructive/race risk.
- **Migration on application startup:** concurrent serverless execution and cold-start failure coupling.
- **Automatic down migrations:** data loss and incomplete reversal of application side effects.
- **Database call during Next build:** makes compilation depend on credentials/network and leaks environment coupling into rendering.
