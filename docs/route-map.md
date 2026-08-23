# Route map and ownership

This map describes implemented ownership through Phase 10: offline replay, private progression, and optional secure Quest attachments are active.

## App Router layout

```text
src/app/
├── layout.tsx                         root metadata and dark theme
├── page.tsx                           / · authentication entry point
├── loading.tsx                        root loading state
├── not-found.tsx                      root not-found state
├── global-error.tsx                   root recovery boundary
├── manifest.ts                        /manifest.webmanifest · install metadata
├── sw.ts                              generated Serwist worker source
├── serwist/[path]/route.ts            /serwist/sw.js + source map · static worker output
├── ~offline/page.tsx                  /~offline · public cached fallback shell
├── unauthorized.tsx                  framework 401 state · implemented
├── forbidden.tsx                     framework 403 state · implemented
├── (auth)/                            public authentication pages · Phase 2
│   ├── sign-in/page.tsx               /sign-in
│   └── sign-up/page.tsx               /sign-up
├── (system)/                          authenticated responsive shell · Phase 3
│   ├── layout.tsx                     session + personal-workspace resolution
│   ├── loading.tsx                    reusable shell skeleton
│   ├── error.tsx                      reusable retry state
│   ├── today/page.tsx                 /today · scheduled/due open Quests
│   ├── quests/page.tsx                /quests · active CRUD + recovery
│   ├── timer/page.tsx                 /timer · focus timer + isolated session history
│   ├── quests/[questId]/page.tsx      /quests/:questId · authorized task details
│   ├── gates/page.tsx                 /gates · Gate lifecycle + filtered links
│   ├── labels/page.tsx                /labels · Label management + filtered links
│   ├── cleared/page.tsx               /cleared · completed Quests + reopen
│   ├── progress/page.tsx              /progress · Hunter Rank, streaks, goals, history
│   ├── settings/page.tsx              /settings · timezone and reminder management
│   └── app/
│       ├── page.tsx                   /app · redirects legacy bookmarks to /today
│       └── workspaces/[workspaceId]/  explicit membership-check route
└── api/
    ├── health/route.ts                GET /api/health · implemented
    ├── auth/[...all]/route.ts         Better Auth GET/POST · implemented
    ├── offline/mutations/route.ts      POST supported queued Quest replay · Phase 8
    ├── cron/reminders/route.ts        GET/POST scheduled reminder worker · Phase 7
    └── cron/attachments/route.ts      GET/POST abandoned upload/deletion cleanup · Phase 10
```

Route groups do not change URLs. Protected pages live under one authenticated layout so navigation shares presentation, but every page/query/action still validates its own server-side access.

## Page ownership

| URL                    | Rendering owner           | Data owner                            | State source                                     | Milestone |
| ---------------------- | ------------------------- | ------------------------------------- | ------------------------------------------------ | --------- |
| `/`                    | `app/page.tsx`            | none                                  | static                                           | Phase 2   |
| `/sign-in`, `/sign-up` | Authentication feature    | Better Auth                           | safe redirect URL search param; form-local state | Phase 2   |
| `/app`                 | App Router redirect       | none                                  | legacy entry point forwards to `/today`          | Phase 2   |
| `/app/workspaces/:id`  | Workspace feature         | membership-predicated workspace query | validated UUID route param                       | Phase 2   |
| `/today`               | Quest Server Component    | Quest query service                   | workspace day plus URL-backed search/filter/sort | Phase 5   |
| `/quests`              | Quest Server Component    | Quest query and mutation services     | CRUD/recovery, discovery, versioned manual order | Phase 6   |
| `/timer`               | Timer feature             | Timer query and mutation services     | focus state and isolated session history         | Current   |
| `/quests/:questId`     | Quest Server Component    | Authorized Quest query service        | stable task-specific details URL                 | Phase 10  |
| `/gates`               | Gate Server Component     | Gate query and mutation services      | active/archived lifecycle and filtered links     | Phase 5   |
| `/labels`              | Label Server Component    | Label query and mutation services     | taxonomy lifecycle and filtered links            | Phase 5   |
| `/cleared`             | Quest Server Component    | Quest query and mutation services     | completed/reopen plus URL-backed discovery       | Phase 5   |
| `/progress`            | Progression feature       | event/ledger/progression queries      | rank, streaks, daily/weekly goals, history       | Phase 9   |
| `/settings`            | Reminder/settings feature | user settings and reminder services   | persisted timezone, schedules, notifications     | Phase 7   |
| `/~offline`            | Offline feature           | device IndexedDB only                 | public shell plus scoped recent Quest snapshot   | Phase 8   |

Protected page reads follow: validate Better Auth session → resolve active membership → construct `AccessContext` → call feature query service → render a serializable view model. The proxy redirects requests with no session cookie to sign-in. A missing/invalid authoritative session renders 401, while an authenticated request without workspace membership renders 403. Future opaque product-resource lookups should normally return `notFound()` across tenant boundaries.

## Route Handler ownership

| Method and path                    | Owner                         | Authentication                     | Purpose and constraints                                                                     |
| ---------------------------------- | ----------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| `GET /api/health`                  | Platform                      | Public                             | Process liveness only; no database dependency; `no-store`                                   |
| `GET, POST /api/auth/[...all]`     | Authentication                | Better Auth protocol               | Sole authentication HTTP surface, delegated directly to the lazy Better Auth handler        |
| `POST /api/offline/mutations`      | Offline/Quest services        | Same origin + session + membership | Revalidates and idempotently replays supported queued Quest creation/completion; `no-store` |
| `GET, POST /api/cron/reminders`    | Reminders                     | Constant-time Bearer `CRON_SECRET` | Claims due reminders idempotently; bounded batch, leases, capped retry; `no-store`          |
| `GET, POST /api/cron/attachments`  | Attachments                   | Constant-time Bearer `CRON_SECRET` | Cleans expired pending uploads and retries stalled deletions; bounded and `no-store`        |
| `GET, POST /api/cron/stale-rooms`  | Timer                         | Constant-time Bearer `CRON_SECRET` | Evicts heartbeat-stale Group Study participants and closes empty rooms; `no-store`          |
| `GET, POST /api/cron/stale-timers` | Timer                         | Constant-time Bearer `CRON_SECRET` | Caps timer sessions running beyond twelve hours; `no-store`                                 |
| Future `/api/v1/*`                 | Explicit external API feature | Versioned external auth            | Added only with an external consumer and separate ADR                                       |

There are no general `/api/quests`, `/api/gates`, `/api/labels`, or `/api/workspaces` endpoints for the application UI. Online Quest, Gate, and Label mutations are authenticated Server Actions; all reads and discovery operations are Server Component query-service calls. The Phase 8 replay endpoint is a deliberately narrow transport for two persisted offline command types and calls the same Quest mutation services.

## Framework state ownership

- `loading.tsx` and Suspense fallbacks describe loading with text/skeleton structure, never color alone.
- Feature-level `error.tsx` files log correlation IDs server-side and show generic recovery text.
- `not-found.tsx` handles unknown routes. Resource pages invoke `notFound()` for missing or unauthorized opaque IDs.
- Empty states are rendered by feature components from empty query results once those features exist.
- Node.js is the default runtime. Route-specific `runtime = "edge"` is prohibited without a decision record.

## Navigation and cache rules

- Shareable filters, dates, sort, and pagination use validated URL search parameters. The shell forwards Home's selected `date` through intermediate destinations so Progress retains the same history context.
- Open dialogs, draft text, selection, and temporary animation state remain component-local.
- Successful actions revalidate the narrow route/tag set they changed after transaction commit.
- User-specific pages are not made public-cacheable. The worker keeps protected navigation and APIs network-only; private snapshots are bounded and scoped by user plus workspace in IndexedDB.
- Route Handlers never import React DOM and do not duplicate an existing Server Action.
