# Gates

Owns the Phase 5 project-like Gate lifecycle, optimistic edits, archive/restore and non-empty deletion rules, and links into server-side Gate-filtered Quest views. Workspace-serialized mutations prevent assignment/lifecycle races, and deletion counts recoverable Quests so it cannot orphan them. Reordering is deliberately not implemented.
