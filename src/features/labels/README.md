# Labels

Owns the Phase 5 workspace-scoped Label lifecycle and transactional, version-predicated Quest-label replacement. Assignment arrays are distinct, capped at 20, and proven against the active workspace before commit. Label deletion removes assignments in the same serialized transaction.
