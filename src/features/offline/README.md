# Offline and PWA

This feature owns the Phase 8 browser-only persistence and synchronization boundary.

- `components/` provides the explicit connectivity/queue status, install guidance, cached offline Quest shell, conflict dialog, and logout clearing control.
- `storage/` owns the versioned `questly-private-offline` IndexedDB schema. Data is bounded and keyed to one authenticated user/workspace scope; activating another scope prunes the previous one.
- `validation/` defines bounded replay commands for Quest creation, editing,
  completion, deletion, and reopening.
- `domain/` contains serializable snapshot, mutation, conflict, and scope contracts.

The service worker caches only the public/static application shell. Quest
snapshots never enter Cache Storage. Reconnection or the Background Sync event
posts queued commands to the same-origin `/api/offline/mutations` handler,
which reconstructs `AccessContext`, revalidates the command, and calls existing
Quest mutation services. UUID idempotency protects creation/completion replay
and `expectedVersion` prevents silent overwrites. Conflicts show both the local
intent and latest server version before the user keeps the server state or
explicitly reapplies the offline change.

Gate, Label, ordering, attachment, and reminder-schedule changes remain
online-only. Push subscriptions are owned by Reminders and private device data
is still cleared during logout.
