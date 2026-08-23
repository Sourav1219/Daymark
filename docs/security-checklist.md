# Security checklist

Legend: `[x]` is present in code or verified configuration through Phase 10, `[ ]` is a required external gate or belongs to a later capability, and `N/A` means the capability does not yet exist. Documentation is not evidence of a completed control.

## Identity and session

- [x] Better Auth is the selected identity/session authority; custom credential storage is prohibited.
- [x] Server environment parsing requires a minimum-length auth secret and valid canonical URL.
- [x] Mount the sole Better Auth catch-all at `/api/auth/[...all]` using its Next.js handler.
- [x] Reconcile Better Auth 1.6.26 with the reviewed Drizzle schema, generated migration, and real-PostgreSQL integration test.
- [x] Use secure, HTTP-only, SameSite=Lax cookies in production and verify canonical/trusted origin settings.
- [x] Validate the full session at every currently implemented protected Server Component and logout action; Better Auth owns its protocol handler validation.
- [ ] Revoke sessions on password reset, account compromise, and user soft deletion.
- [x] Persist multi-instance PostgreSQL rate limits for the implemented sign-in and sign-up endpoints; each future reset, verification, invitation, upload, or external endpoint must add its own reviewed rule.
- [x] Prevent open redirects by accepting only local absolute redirect paths and rejecting protocol-relative/external values.

## Tenancy and authorization

- [x] `AccessContext` contains `userId`, `workspaceId`, and the resolved workspace role.
- [x] Architecture forbids authorization decisions in UI components and direct database access from React components.
- [x] Every implemented protected entry point derives `AccessContext` from a validated session and active membership, never solely from request input.
- [x] Every implemented user-owned application read passes `AccessContext` to persistence; the registration bootstrap exception is documented.
- [x] Every implemented user-owned repository query predicates on `workspaceId` and the authenticated user/membership relation.
- [x] Cross-tenant and unauthorized Quest, Gate, Label, and parent IDs return `NOT_FOUND` or safe validation failures without disclosing existence.
- [x] Repository integration tests prove two users/two workspaces cannot cross Quest, Gate, Label, placement, or assignment read/mutation boundaries and soft-deleted access stops working.
- [ ] Owner/admin invariants prevent removing or demoting the final workspace owner.
- [x] Re-check active user, workspace, membership, and Quest state for every attachment metadata mutation, listing, download signature, and deletion.

## Input, output, and browser security

- [x] Zod is configured and environment contracts have positive/negative tests.
- [x] Expected action failures use a typed allow-list of safe codes/messages.
- [x] Placeholder uses semantic landmarks, text-redundant status, visible focus, and no untrusted HTML.
- [x] Validate all currently implemented auth forms and workspace route parameters with Zod; future boundaries remain unchecked until introduced.
- [x] Quest/Gate/Label commands bound text, enum values, UUIDs, optimistic versions, real UTC timestamps, schedule ordering, Subquest depth/cycles, and distinct Label arrays capped at 20.
- [ ] Never use `dangerouslySetInnerHTML` for Quest notes or external content without a reviewed sanitizer and threat model.
- [x] Encode user content through React; attachment object keys are server-generated and signed URLs come only from the server-side R2 adapter.
- [x] Keep Server Actions same-origin, retain framework/Better Auth CSRF and origin protections, and configure only the canonical trusted auth origin.
- [x] Apply CSP, frame ancestors/`X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`, and a restrictive permissions policy to every route.
- [x] Service-worker runtime caching is allow-listed to public static/media assets; protected documents, RSC payloads, API/auth responses, cookies, and secrets remain network-only.
- [x] Bound private Quest snapshots and commands in versioned IndexedDB by user/workspace scope; prune other scopes and delete the database before logout.
- [x] Require same-origin replay, a current session and membership, strict bounded commands, existing domain authorization, and `expectedVersion` before applying an offline mutation.

Phase 3 accessibility evidence: each shell route has a unique heading; primary navigation exposes `aria-current`; mobile navigation and confirmation use Radix focus management; a skip link targets the main landmark; toast messages are announced; global motion reduction is enforced; axe-core, keyboard, and responsive Playwright smoke tests are required gates.

## Secrets and data protection

- [x] `.env*` is ignored while `.env.example` contains placeholders only.
- [x] Database and server env accessors are server-only and lazy, so build does not require secrets.
- [x] No client-visible environment variable is required through Phase 10; R2 credentials are grouped, validated, and imported only by server-only code.
- [ ] Store production secrets in Vercel environment scopes; never log them or expose them to client components.
- [ ] Use Neon's TLS connection and a least-privilege application role; use a separate migration role where feasible.
- [ ] Encrypt provider access/refresh tokens at rest; hash passwords and one-time verification values through Better Auth's supported mechanisms.
- [ ] Define retention, export, deletion, and anonymization policies for account data and immutable activity events.
- [ ] Scrub emails, tokens, Quest text, filenames, and storage URLs from logs unless explicitly required and protected.
- [ ] Rotate Better Auth, cron, webhook, storage, and database credentials with a tested overlap procedure.

## Database integrity

- [x] Drizzle configuration points only at reviewed migration output; production schema push is not scripted.
- [x] The logical model specifies foreign keys, indexes, soft deletion, UTC timestamps, and numeric optimistic versions.
- [x] Review generated SQL and Drizzle snapshots through Phase 7, including recurrence, settings, reminders, deliveries, and notifications.
- [x] Review Phase 8's nullable offline mutation UUID and workspace-scoped unique partial index; replay UUIDs provide idempotency without storing credentials client-side.
- [x] Use a real PostgreSQL transaction for personal-workspace plus owner-membership provisioning; future multi-row writes retain this requirement.
- [x] Quest updates predicate on ID, workspace, active membership/workspace, lifecycle state, and `expectedVersion`, then increment version atomically.
- [x] Enforce identity/workspace invariants plus Quest status, priority, non-negative position/XP, version, foreign-key, and scheduling indexes in PostgreSQL.
- [x] Composite foreign keys enforce that Gate, parent Quest, Quest-label, and Label relationships share one workspace even if application validation regresses.
- [x] Serialize organisation mutations per workspace so Gate lifecycle, Label assignment/deletion, and Subquest cycle checks cannot race.
- [x] Back substring Quest search with partial `pg_trgm` GIN indexes while retaining the 200-row query cap.
- [x] Bound Quest lists and whole-scope reorder inputs to 200 rows and Label assignment arrays to 20 IDs; reorder rejects omissions, duplicates, foreign IDs, and stale versions before writing.
- [ ] Verify Neon backups/PITR and practice restoration before production launch.

## Attachments, webhooks, and background work

- [x] Sign uploads only after full session/workspace/Quest authorization.
- [x] Allow-list PDF/JPEG/PNG/WebP by stored magic bytes, cap files at 10 MiB, require the actual length to match the receipt, and generate opaque keys without browser filenames.
- [x] Use five-minute PUT and 60-second GET URLs against a private bucket; permanent R2 credentials never enter client code.
- [x] Promote verified staging objects with a source ETag condition to a separate permanent key so signed PUT replay cannot overwrite ready content.
- [x] Model upload metadata as pending→ready/failed and deletion as deleting→deleted; a protected bounded job cleans abandoned/stalled objects.
- [x] Verify reminder cron Bearer secrets in constant time and reject unsigned requests before job processing; future webhook replay rules remain unchecked.
- [x] Claim durable unique reminder delivery keys before external side effects and acknowledge duplicate deliveries safely.
- [x] Use bounded reminder batches, `FOR UPDATE SKIP LOCKED`, expiring leases, delayed retry, attempt caps, and terminal failure state.
- [x] Keep email content generic and omit Quest text, email addresses, provider payloads, and raw errors from failure logs.

## Errors, observability, and dependencies

- [x] Global error recovery shows generic copy rather than infrastructure details.
- [x] Dependencies are exact-pinned and pnpm's build-script allow-list is explicit.
- [ ] Generate request/correlation IDs and record structured, redacted server errors.
- [ ] Alert on auth anomalies, authorization denials, migration failures, webhook signature failures, reminder backlog, and repeated object cleanup failures.
- [ ] Ensure health is a liveness check; add a separate protected readiness/diagnostic check if operations require database status.
- [ ] Run lockfile integrity, dependency audit, lint, strict typecheck, tests, build, and E2E gates in CI on Node 24.
- [ ] Review dependency additions for necessity, license, maintenance, server/client impact, and supply-chain risk.

## Release security gate

A feature cannot ship until its unchecked applicable items are implemented or converted into an accepted, time-bounded risk with owner and follow-up. The implementing pull request links tests or configuration as evidence; checking this document alone is insufficient.
