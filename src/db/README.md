# Database boundary

`client.ts` owns the lazy postgres.js/Drizzle client for a pooled Neon-compatible PostgreSQL URL and must remain server-only. It disables prepared statements for transaction-pool compatibility and supports the transactions needed by provisioning. `schema/` owns relational declarations. Feature repositories may call `getDatabase()`; client components and shared UI code may not.

Every user-owned repository method accepts an authenticated `AccessContext` and includes both `userId` and `workspaceId` in its predicate. The narrow authorization/provisioning exceptions are defined in `docs/access-context-contract.md`. Schema edits and generated SQL enter the same review and are applied only through `drizzle-kit migrate` in deployment.
