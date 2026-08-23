# Activity events

Owns immutable, tenant-scoped audit and product activity events. Events are written transactionally with the mutation they describe.

Phase 9 records Quest completion, reopening, deletion, and restoration with a
workspace-unique idempotency key. Payloads contain only the server-loaded Quest
facts needed to explain the progression decision; no activity mutation API is
exposed to clients.
