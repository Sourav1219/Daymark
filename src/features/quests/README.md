# Quests

The Quest lifecycle includes Gate assignment, Labels, bounded Subquests, server-side URL-backed discovery, transactional manual ordering, Phase 7 recurring successors, and Phase 8 idempotent replay for supported offline creation/completion.

Reminder inbox entries and progression history link back to the task's dated Home card. Home centers and highlights the requested task without opening a separate details route.

- `domain/` owns semantic types, safe service errors, and workspace-day calculation.
- `validation/` owns strict Zod create, edit, and transition commands.
- `authorization/` owns workspace-role policy without rendering decisions.
- `repositories/` is the only Quest layer that imports Drizzle schema. Every operation accepts `AccessContext` and predicates on its user membership and workspace.
- `queries/` returns serialized presentation models for Server Components.
- `mutations/` applies domain transitions and optimistic version checks.
- `application/actions.ts` exposes seven authenticated Server Actions and narrowly revalidates affected Quest and Gate views.
- `components/` contains the Server Component route owner and client-only forms/interactions.

Create, completion, and reorder interactions use optimistic UI with announced rollback. Pointer drag, touch-friendly buttons, and keyboard alternatives call one bounded, versioned reorder transaction. Completing a recurring Quest calculates and inserts one DST-safe successor in the same transaction, preserves the recurrence series, and carries pending reminder lead times forward. Offline creation/completion is revalidated through the same mutation service; the persisted mutation UUID makes replay idempotent and does not bypass workspace authorization or optimistic versions. Phase 9 completion, reopening, deletion, and restoration append activity/XP records and rebuild the user's progression projection in the same workspace-locked transaction.
