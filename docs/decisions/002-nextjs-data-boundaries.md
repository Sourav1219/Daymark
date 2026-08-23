# ADR 002: Next.js data boundaries

- Status: Accepted
- Date: 2026-08-08

## Context

Next.js offers Server Components, Server Actions, and Route Handlers, each of which could become an overlapping data API. An unrestricted mix creates duplicate authorization, cache behavior, validation, and error contracts. Client-side direct fetching also risks unnecessary waterfalls and server-module leakage.

## Decision

- React Server Components perform authenticated reads by calling feature query services. Components never query Drizzle directly.
- Server Actions handle mutations initiated by the application UI. They validate sessions/inputs, create `AccessContext`, call mutation services, return typed results, and revalidate after commit.
- Route Handlers are reserved for Better Auth, health, signed uploads, scheduled jobs, webhooks, and explicitly approved future external APIs.
- The Node.js runtime is the default.
- Shareable read state uses validated URL search parameters; temporary interaction state stays local. Global client state requires evidence that unrelated areas truly share live state.

Feature services, not transport adapters, enforce authorization and domain rules. Route Handlers and Server Actions do not import repositories as shortcuts. Cache keys for private data are tenant-aware; request-local React caching may deduplicate secure reads.

## Consequences

- Internal UI data avoids a redundant REST layer and client waterfall.
- External surfaces remain small and auditable.
- Mutation contracts have progressive enhancement and end-to-end TypeScript support.
- Server Actions are not externally stable APIs and always use POST; a real external consumer requires a versioned Route Handler and ADR.
- Client components receive minimized serializable view models, not Date/class/Drizzle objects.

## Alternatives rejected

- **REST for every CRUD operation:** duplicated application APIs and authorization for no external consumer.
- **Database reads in page components:** couples presentation to persistence and prevents repository authorization testing.
- **Client-first fetching/global store:** adds hydration and synchronization work without a cross-area state requirement.
