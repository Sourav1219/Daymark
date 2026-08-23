# ADR 001: Modular monolith

- Status: Accepted
- Date: 2026-08-08
- Owners: Daymark engineering

## Context

Daymark spans authentication, tenant membership, Quests, Gates, Labels, reminders, attachments, progression, and activity events. These capabilities have distinct domain rules but share transactions and a single personal-product release cadence. Separate services would introduce distributed authorization, event consistency, deployment, observability, and local-development cost before there is evidence that independent scaling or ownership is necessary.

## Decision

Use one repository, one Next.js application, one Neon PostgreSQL database, and one Vercel-compatible deployment. Organize code into explicit feature modules. Each feature owns validation, authorization, queries, mutation services, repositories, presentation models, and local components. Cross-feature work goes through application-service contracts and, when consistency matters, one database transaction.

Dependency direction is `app/UI → feature public API → application service/policy → repository → db`. UI cannot import Drizzle or decide authorization. Repositories cannot contain presentation or Next.js cache/navigation logic.

## Consequences

- Atomic Quest/activity/progression and other multi-feature writes remain straightforward.
- One deploy and database simplify operations and local development.
- Boundaries require review/lint discipline because the language does not make modules physically remote.
- A slow query or deployment affects the shared application, so observability must attribute work by feature.
- A future extraction is possible only after a feature has a stable service boundary, measured independent scaling/reliability need, and an explicit data-consistency plan. Extraction is not a roadmap goal.

## Alternatives rejected

- **Layer-only monolith:** simpler initially but encourages domain leakage and weak ownership.
- **Microservices/event-first architecture:** unjustified operational/distributed-transaction complexity for one product/team.
- **Separate frontend/backend REST applications:** duplicates types and adds HTTP round trips for internal reads/mutations already served well by RSC and Server Actions.
