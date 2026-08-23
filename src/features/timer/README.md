# Timer

Owns authenticated focus timing and a history that is deliberately separate
from task progression, activity events, and the XP ledger.

- One user may have one running or paused session per workspace.
- Running duration is derived from persisted wall-clock timestamps, so browser
  scheduling throttles, background tabs, and window minimization do not pause or
  slow the timer.
- Pause stores the exact accumulated duration; resume starts a new timestamped
  interval without resetting that value.
- The active subject and completed history subjects remain editable through
  version-predicated Server Actions.
- A tab-scoped lifecycle boundary uses `pagehide` plus `sendBeacon` to request a
  best-effort immediate finish when the document closes. It never listens to
  visibility or focus changes.
- Registered users can create or join an active Group Study room with a unique
  eight-character code, room name, objective, and participant limit. Every
  participant still owns a separate
  `timer_sessions` row, so pause, resume, editing, background timing, and stop
  remain fully independent.
- Group membership and its append-only joined/paused/resumed/left timeline live
  in Timer-owned tables. Stopping marks only that participant as left; the room
  closes transactionally after its final participant leaves.
- Host-only controls can update room details, lock joining, rotate the join
  code, or remove/block another participant. Moderation completes only the
  affected participant's timer; blocks prevent that user from rejoining the
  same room.
- Active rooms refresh participant state in the Timer UI, and completed room
  timelines remain browsable as Timer-only shared history with a final total,
  duration, and per-participant focus summary.
- The Timer page shows completed solo and shared-participant records only for
  the current workspace-local day. Home presents the complete, date-grouped
  study total beneath its task sections; shared sessions are counted through
  each participant's own timer row, never through activity events.

Timer data is stored only in `timer_sessions` and the `group_study_*` tables. It
never writes `activity_events`, `xp_ledger`, or `user_progression`.
