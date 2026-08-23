# Product and engineering roadmap

The roadmap is capability-ordered. A milestone starts only after the preceding completion gate remains green. Dates are intentionally omitted until product capacity and external infrastructure are known.

## Phase 1 — Architecture and compiling skeleton

Scope: system/data/route/action/security/testing/deployment documentation; accepted ADRs; Node/pnpm/Next/React/Tailwind/shadcn/Drizzle/Better Auth/Zod/test tooling; CSS motion contracts; environment contracts; feature skeleton; original placeholder; health route.

Gate:

- All requested architecture subjects and boundaries are documented.
- Strict typecheck, lint, unit/component tests, production build, and placeholder Playwright smoke pass.
- Build does not require a database.
- No functional Quest UI or database migration exists.

## Phase 2 — Database, authentication, and workspace authorization

Scope: Better Auth identity/session tables and configuration, workspace/member schema, reviewed Drizzle migration, email/password registration and login, database-backed production rate limits, secure sessions, logout, personal workspace provisioning, protected routes, typed access context, authoritative membership checks, and 401/403 states.

Gate:

- A user can register, receive a secure session, enter the provisioned personal workspace, log out, and log in again.
- Unauthenticated protected navigation is redirected and invalid authoritative sessions are rejected.
- Membership queries allow the user's workspace and deny a second workspace.
- The generated migration applies to clean PostgreSQL, Drizzle reports no migration errors, and static/unit/integration/browser verification passes.
- No Quest, Gate, Label, or progression behavior is implemented.

Status: implemented locally; preview/production Neon and Vercel binding remain release-environment work.

## Phase 3 — Design system and responsive application shell

Scope: reusable Tailwind/shadcn design tokens, authenticated desktop and mobile shell navigation, command and content regions, optional desktop rank placeholder, page headings, empty/loading/error states, confirmation and toast feedback, accessible focus, and placeholder routes for Today, Quests, Gates, Cleared, Progress, and Settings.

Gate:

- All six shell routes share authoritative Phase 2 authentication/workspace authorization.
- Desktop, mobile, and keyboard navigation work and expose the current page accessibly.
- Token, semantic component, reduced-motion, axe-core, type, test, and production-build gates pass.
- No database-backed Quest, Gate, Label, or progression functionality exists.

Status: implemented locally; preview-device and production-environment verification remain release work.

## Phase 4 — Core Quest domain and CRUD

Scope: additive `tasks` migration; workspace-scoped repository; Quest types, validation, authorization, queries, mutations, and Server Actions; active, Today, Cleared, and recovery views; priority and UTC scheduling; optimistic completion only.

Gate:

- Authenticated members can create, read, edit, complete, reopen, soft-delete, and restore their own workspace Quests.
- Every repository operation accepts `AccessContext`; cross-workspace IDs, fabricated contexts, and deleted memberships/workspaces cannot read or mutate Quests.
- Version-predicated writes surface conflicts without overwriting newer data.
- Migration, validation, PostgreSQL integration, browser journey, accessibility, type, lint, and production-build gates pass.
- Gate/project behavior, recurrence execution, XP/progression, labels, activity events, and advanced ordering remain absent.

Status: implemented locally; preview/production Neon migration and Vercel verification remain release-environment work.

## Phase 5 — Gates, Labels, Subquests, Search and Filters

Scope: additive Gate, Label, and Quest-label migration; Gate create/edit/archive/restore/delete rules; Quest Gate assignment; Label create/edit/delete and versioned attach/detach; two-level Subquests with cycle prevention; bounded server-side search, status/priority/Gate/Label/due-date filters and sorting; URL-backed Today, All Quests, Gate, Label, and Cleared views; reset and filtered-empty states.

Gate:

- Members can organise Quests with active/archived Gates, reusable Labels, and nested Subquests without crossing workspace boundaries.
- Search, filters, and sort execute only through the authenticated Quest query service; client controls only validate and update shareable URL parameters.
- Two-user/two-workspace PostgreSQL suites cover Gate, Label, placement, filter, concurrency, and bounded-list behavior; the Phase 5 Playwright journey covers the combined UI flow.
- Drag-and-drop/reordering controls, reminders, recurrence execution, XP/progression, and activity events remain absent.

Status: implemented, hardened, and verified locally on a clean disposable PostgreSQL database. Composite tenant constraints, serialized organisation mutations, trigram search indexes, filtered-edit preservation, and security headers are included; preview/production Neon migration and Vercel verification remain release-environment work.

## Phase 6 — Interaction, Keyboard Control and Optimistic UX

Scope: pointer drag-and-drop plus touch/keyboard order controls; transactional, version-predicated Quest ordering; command menu and keyboard shortcuts; optimistic create, completion, and reorder with rollback; conflict announcements; responsive focus management; short Arise completion feedback with a non-animated reduced-motion equivalent; and route-level loading/error boundaries.

Gate:

- Quest creation and completion work from the keyboard; manual order works with pointer drag, touch-friendly buttons, and Alt+Arrow controls.
- Ordering validates the complete bounded active scope and every optimistic version before a workspace-serialized transaction commits.
- Failed completion/reorder operations restore server truth and announce the rollback; animation never gates persistence or input.
- Desktop/mobile, focus restoration, reduced motion, drag, keyboard reorder, rollback, accessibility, PostgreSQL, and production-build checks pass.

Status: **MVP complete.** Phase 6 is implemented and verified locally. Do not begin Phase 7 automatically.

## Phase 7 — Recurring Quests and Reminders

Scope: RFC 5545 recurrence rules with IANA user timezones; DST-safe next-occurrence calculation and preview; recurring-Quest successors; editable and cancellable in-app/email reminders; idempotent delivery records; a protected, bounded scheduled Route Handler; replaceable delivery providers; capped retries; and privacy-safe failure logging.

Gate:

- Completing a recurring Quest creates one correctly scheduled successor and carries eligible reminder lead times forward without duplicate occurrences.
- Recurrence tests cover timezone offsets, daylight-saving gaps/folds, monthly rules, bounded counts, and invalid rules.
- Reminder claiming rechecks tenancy, uses row locks and leases, records delivery idempotently, caps retries, and is testable with a fake provider.
- Scheduled invocation requires `CRON_SECRET`; email uses the replaceable Resend adapter only when configured.
- Migration, unit/integration, browser, accessibility, type, lint, and production-build checks pass.

Status: **Phase 7 complete.** Implemented and verified locally.

## Phase 8 — Installable PWA and Offline Support

Scope: web manifest; original icon and splash assets; Next.js 16-compatible Serwist/Turbopack worker; versioned public application shell; explicitly scoped IndexedDB Quest snapshots; offline status; queued Quest create/completion; idempotent authenticated replay; version conflicts and resolution UI; bounded transient retry; cache migration; and private-data clearing before logout.

Gate:

- The generated worker installs at root scope and only precaches public/static shell assets; authenticated documents, RSC payloads, API/auth responses, cookies, and secrets are not runtime-cached.
- A signed-in user can read a bounded recent Quest snapshot offline and queue supported creation/completion commands without implying that unsupported edits are safe offline.
- Reconnection revalidates session, membership, input, and `expectedVersion`; duplicate mutation UUIDs are idempotent and conflicts remain explicit until resolved.
- Switching authenticated scope prunes another user's browser data, logout deletes private IndexedDB data, and cache/IndexedDB versions have an explicit migration policy.
- Unit, route, PostgreSQL idempotency, production-worker, offline/reconnection, logout, static, and build checks pass.

Status: **Phase 8 complete.** Implemented and verified locally. Stop after Phase 8; do not begin a later phase automatically.

## Phase 9 — Hunter Rank, XP and Streaks

Scope: immutable, tenant-scoped Quest activity events; append-only XP ledger;
rebuildable per-user progression projection; server-side priority scoring;
Hunter Rank thresholds; timezone-aware streaks and daily/weekly progress;
idempotent completion awards; reopen/delete corrections; completed-Quest restore
awards; private rank/history presentation; and accessible, reduced-motion Arise
feedback. Competitive, leaderboard, and social features are excluded.

Gate:

- Quest state, event, ledger, and progression writes share one authorized,
  workspace-serialized transaction.
- A replayed completion cannot duplicate XP; reopening and completed-Quest
  deletion append exact, one-time reversals; restore/re-completion rules are
  covered by domain and PostgreSQL integration suites.
- Rank, streak, daily/weekly, history, live-region, reduced-motion, migration,
  type, lint, test, and production-build gates pass.

Status: **Phase 9 complete locally.** All migrations apply to a clean isolated
PostgreSQL database and the full unit/component/integration suite passes.
Preview/production migration remains release-environment work. Stop after
Phase 9.

## Phase 10 — Secure Attachments

Scope: optional private Cloudflare R2 storage; Quest/workspace attachment
metadata; five-minute signed PUTs; PDF/JPEG/PNG/WebP byte allowlist; 10 MiB
limit; randomized staging and permanent keys; conditional verified promotion;
authorized 60-second downloads; retry-safe deletion; scheduled abandoned
upload cleanup; and accessible progress, verification, success, and failure
states. Browser filenames and permanent storage credentials are excluded from
the protocol.

Gate:

- Only a current workspace member can create, list, download, or delete Quest
  attachment metadata in that workspace; cross-workspace identifiers remain
  indistinguishable from missing identifiers.
- Stored length and magic bytes are checked by the server after upload, and a
  reusable signed staging URL cannot overwrite a ready object.
- Clean migration, unit/component/real-PostgreSQL authorization and lifecycle
  tests, lint, typecheck, and production build pass.

Status: **Phase 10 complete locally.** Real R2 bucket creation, scoped token,
CORS policy, lifecycle rule, and preview/production environment binding remain
release-environment work. Stop after Phase 10.

## Milestone 1 — MVP: identity and core Quest loop

Incremental phases should keep migrations and features reviewable:

1. Better Auth tables/config/routes and secure sign-up/sign-in/sign-out/session flows. **Completed in Phase 2.**
2. Personal workspaces, owner membership, workspace resolution, and cross-tenant repository tests. **Completed in Phase 2.** Shared-workspace management remains future scope.
3. Core Quests with CRUD, soft deletion/recovery, and optimistic concurrency. **Completed in Phase 4.**
4. Gates, Labels, bounded Subquests, and shareable server-side Quest filters. **Completed in Phase 5.**
5. Responsive interaction, transactional ordering, command controls, optimistic rollback, and complete route states. **Completed in Phase 6.**

MVP outcome: a user can securely enter a private workspace, organize Quests into Gates, manage Daily Quests and Labels, clear/reopen work, and recover deleted content. UI mutations are Server Actions; reads are authenticated Server Component query services.

MVP gate:

- Authorization-sensitive repositories pass two-user/two-workspace integration suites.
- Core Quest journeys pass Playwright on mobile and desktop viewports with keyboard access.
- AA contrast, visible focus, screen reader semantics, and reduced-motion behavior are verified.
- Migrations are reviewed and tested clean/upgrade; preview deploy and Neon branch are verified.
- No attachment, offline/PWA, or gamification behavior is implied by inactive controls. Reminder behavior is delivered separately in Phase 7.

## Milestone 2 — Reminders, PWA, and attachments

Capabilities:

- Durable reminder schedule/state, signed cron invocation, transactional claiming, retries, idempotency, delivery privacy, and operational backlog visibility. **Reminder scope completed in Phase 7.**
- PWA manifest/icons/service-worker strategy, installability, offline read shell, explicit offline mutation behavior, update/recovery UX, and cache privacy review. **Completed in Phase 8.**
- Attachment metadata, allow-listed signed uploads, pending/finalized lifecycle, checksum/size/type validation, tenant-authorized access, retryable deletion, and orphan cleanup.

Gate:

- Duplicate worker/webhook invocations produce one side effect.
- Signed endpoint replay/signature/rate-limit tests pass.
- Offline/PWA caches never expose another user's or workspace's data.
- Attachment abuse, cross-tenant access, failure recovery, and cleanup paths pass integration/E2E tests.
- Required external services, credentials, retention, and alerts are verified in preview and production runbooks.

## Milestone 3 — Progression and meaningful gamification

Capabilities:

- Server-owned experience, streaks, Hunter Rank thresholds, and a rebuildable progression model derived from eligible Quest activity.
- Accessible rank history/progress presentation.
- Restrained Arise glow only for meaningful completion/rank events, with visible text/live-region feedback and a reduced-motion alternative.
- Abuse/duplicate/reopen correction rules and transparent scoring documentation.

Gate:

- Domain tests cover thresholds, timezone streaks, duplicates, reversals, rebuilds, and integer bounds.
- Progression and Quest/activity writes commit atomically and remain tenant-scoped.
- Animation stays event-bound, ordinary transitions remain about 150–250 ms, and reduced-motion removes nonessential effects.
- The feature improves the core loop without blocking or shaming users; settings allow appropriate control.

## Later candidates, not commitments

Collaboration refinements, external APIs, calendar integrations, advanced search, shared templates, and analytics require explicit product evidence, privacy review, and their own decisions. The monolith is not split merely in anticipation of scale.
