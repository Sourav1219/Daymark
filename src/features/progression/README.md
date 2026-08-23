# Progression

Owns server-authoritative Hunter Rank, XP, streak rules, daily/weekly progress,
and accessible Arise feedback contracts.

## Scoring and rank rules

- Quest priority is loaded inside the authorized completion transaction. Low,
  medium, high, and critical Quests award 10, 20, 35, and 50 XP respectively.
  No action or client component accepts an XP value.
- Hunter Ranks E, D, C, B, A, and S begin at 0, 250, 750, 1,500, 3,000,
  and 5,000 XP. The projection stores the rank and level, while reads derive
  presentation progress from the audited total.
- A local day contributes once to a completion streak when it has at least one
  effective award. The current streak remains live through the day after its
  latest clear. Daily and ISO-week progress use the user's configured timezone.
- Daily and weekly possible points are the sum of the priority values of tasks
  assigned to those local periods, rather than fixed goals. Completed tasks add
  their awards to earned points; missed-task penalties and lifecycle reversals
  reduce earned points without removing the task from the possible total. This
  prevents deleting a missed task from rewriting the historical target.
- Voluntarily deleting an open task is treated as cancellation: it creates no
  XP penalty and removes that task's priority value from the daily and weekly
  possible totals. The swipe action remains recoverable through same-day Trash.
- Reopening or soft-deleting a completed Quest appends an exact reversal of its
  active award. Restoring that completed Quest appends a matching award. Open
  Quest deletion/restoration is still audited but has no XP effect.

`user_progression` is a rebuildable projection. `xp_ledger` is append-only in
the application and references immutable `activity_events`. Per-lifecycle
idempotency keys and unique reversal targets prevent duplicate awards and
corrections under retry or replay.
