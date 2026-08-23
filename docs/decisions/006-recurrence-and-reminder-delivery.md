# ADR 006: Calendar recurrence and replaceable reminder delivery

Status: accepted for Phase 7 on 2026-08-09.

## Context

Recurring Quests must preserve a user's local wall-clock intent across timezone and daylight-saving changes. Reminders need durable, duplicate-safe processing without coupling Quest transactions to one email provider or exposing personal Quest content in operational logs.

## Decision

Store a normalized single RFC 5545 recurrence rule, IANA timezone, stable series UUID, occurrence instant, and sequence on recurring Quests. Parse local date/time with Luxon, reject nonexistent DST wall times, use `rrule` for calendar expansion, and convert each local occurrence back to an absolute instant. Completing an occurrence creates at most one successor inside the Quest transaction; a database uniqueness constraint on `(recurrence_series_id, recurrence_occurrence_at)` is the final duplicate guard.

Reminders are a separate subsystem. User-facing schedules are versioned and workspace-authorized. The worker authenticates with `CRON_SECRET`, claims a bounded batch with row locks and a recovery lease, rechecks current access, and writes a unique delivery record before invoking a `ReminderDeliveryProvider`. Resend is one adapter, not a domain dependency. Tests use a fake provider.

Retries use fixed bounded delays and a hard attempt cap. In-app delivery creates a durable notification through the same processor. Provider errors are mapped to safe codes; logs omit email addresses, Quest titles/descriptions, provider payloads, and raw errors.

## Consequences

- Local recurrence intent survives offset and DST changes while persistence remains UTC.
- Completion, successor creation, label copying, and reminder carry-forward are atomic.
- Duplicate scheduler invocations and provider retries converge on one logical side effect.
- Production must configure and monitor the cron secret and optional Resend sender separately.
- The worker is deliberately online-only; service-worker push and offline behavior remain future scope.

## Rejected alternatives

- Fixed millisecond intervals, because they drift across DST and cannot express monthly calendar rules.
- Creating an unbounded recurrence series in advance, because it creates unnecessary rows and complex edit/cancellation behavior.
- Sending email directly from Quest actions, because request retries and provider latency would couple persistence to an external side effect.
- Provider-specific fields in the reminder domain, because they make replacement and deterministic testing harder.
