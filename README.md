# Daymark

Daymark is a production-minded personal todo application expressed as an original dark fantasy “System/Hunter” interface. Phases 1–10 provide authenticated personal workspaces, Quest CRUD and recovery, Gates, Labels, bounded Subquests, shareable server-side discovery, transactional Quest ordering, keyboard control, optimistic interactions, recurring Quests, reminders, an installable offline-capable PWA, private server-authoritative Hunter progression, and optional secure Quest attachments.

**Project status: Phase 10 complete.** Optional Cloudflare R2 attachments use short-lived direct uploads, server-derived file types/names, staging-to-private-key promotion, workspace authorization, signed downloads, deletion, and scheduled abandoned-upload cleanup. Permanent storage credentials remain server-only. Competitive/social features and later phases remain deliberately inactive.

## Local setup

1. Use Node.js 24 and enable Corepack.
2. Run `pnpm install --frozen-lockfile`.
3. Copy `.env.example` to `.env.local` when a phase needs database or authentication services.
4. Run `pnpm dev`.

The landing page and `/api/health` compile without environment variables or a live database. Runtime services call the lazy database and environment accessors only when needed.

## Quality commands

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm test:pwa
```

Architecture and delivery decisions begin in [`docs/architecture.md`](docs/architecture.md). Database schema changes must be generated with `pnpm db:generate`, reviewed, and applied with `pnpm db:migrate`; production schema push is prohibited.
