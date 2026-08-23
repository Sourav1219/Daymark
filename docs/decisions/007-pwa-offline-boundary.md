# ADR 007: Serwist Turbopack worker and private offline boundary

Status: accepted for Phase 8 on 2026-08-09.

## Context

Daymark needs an installable offline shell, recent read-only Quest access, and replayable mutations without weakening its server-owned authorization and version checks. Next.js 16 uses Turbopack by default, so webpack-only service-worker plugins are not an acceptable hidden build downgrade. Authenticated HTML, React Server Component payloads, API responses, cookies, and tokens must not be placed in broad HTTP caches.

## Compatibility decision

Use exact-pinned `@serwist/turbopack` and `serwist` 9.5.12. The installed Next.js 16.3 PWA guide lists Serwist for full worker caching, and Serwist maintains a Turbopack integration guide and example against Next 16. Its package peer range supports Next 14+, React 18+, and TypeScript 5+. The normal `next dev` and `next build` Turbopack commands remain unchanged.

References:

- [Next.js Progressive Web Apps guide](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Serwist Turbopack integration](https://serwist.pages.dev/docs/next/turbo)
- [Serwist Next 16 Turbopack example](https://github.com/serwist/serwist/tree/main/examples/next-turbo-basic)

## Decision

Serwist precaches the generated public/static application assets, manifest, icons, and one public `/~offline` document. Navigation is network-only with that document as its failure fallback. Runtime caching is allow-listed to same-origin `/_next/static` scripts/styles/fonts and original icon/splash images. Protected documents, RSC requests, Server Actions, `/api/*`, `/api/auth/*`, cookies, and JSON responses are never runtime-cached.

Private offline data uses an independently versioned IndexedDB database. It stores only the active user's workspace identity, a bounded serialized Quest view, and bounded mutation commands. It never stores session cookies, authorization headers, password fields, auth responses, provider payloads, or reminder email addresses. Activating a different authenticated scope removes old scopes; logout deletes the database before server sign-out and asks the worker to remove any private cache namespace.

Phase 8 queues Quest creation and completion only. Reconnection replays commands through a same-origin, session-authenticated Route Handler that reconstructs `AccessContext`, revalidates inputs, and calls existing Quest services. A UUID persisted with the Quest makes create/completion replay idempotent. `expectedVersion` detects newer server changes; conflicts remain local until the user keeps server state or explicitly retries against the displayed latest version.

## Cache migration and update policy

The worker and runtime cache names carry an explicit version and activation removes obsolete Daymark cache generations. IndexedDB uses schema version 2 with an upgrade transaction that removes the legacy unscoped store. Schema changes increment the database version and migrate or discard incompatible private snapshots; an app update never silently interprets an older command shape.

## Consequences

- The PWA remains compatible with Next.js 16's default build path.
- Offline data is deliberately smaller than the online product and is not a second source of truth.
- Opening a protected URL offline renders the public shell, which then reads only the current device's private IndexedDB snapshot.
- Unsupported edits, labels, ordering, reminders, and Gate changes remain online-only and are never implied to be queued.
- Background replay occurs when an open client detects reconnection; service-worker push and autonomous closed-app mutation processing remain outside Phase 8.
