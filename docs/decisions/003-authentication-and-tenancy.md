# ADR 003: Better Auth and workspace tenancy

- Status: Accepted
- Date: 2026-08-08

## Context

Every user-owned operation must be isolated by user and workspace. Route hiding, client state, a workspace cookie, or an ID lookup alone is not authorization. Authentication tables also need to remain compatible with the selected Better Auth version without placing provider/database errors in the UI.

## Decision

Better Auth owns users' credential/account/session/verification protocol and is mounted once at `/api/auth/[...all]`. Protected server entry points validate the full session from request headers/cookies. A workspace policy resolves an active, non-deleted membership and creates immutable `AccessContext { userId, workspaceId, role }`.

Every user-owned application-service and repository method requires this context. Services authorize the requested operation and repositories include both tenant and authenticated-user/membership proof in SQL predicates. User-supplied `workspaceId` or resource IDs never create authority. Cross-tenant opaque IDs normally map to `NOT_FOUND`.

Proxy cookie checks may perform optimistic redirects but never grant access. Owner/admin/member policies live in the workspace authorization module. The last active owner cannot be removed or demoted. Multi-record tenant changes and activity events are transactional.

## Consequences

- Authorization is defense-in-depth and testable at service/repository boundaries.
- Queries may be slightly more verbose due to membership joins/predicates; indexes cover them.
- Background work and webhooks must carry trusted tenant identifiers and still load/re-check relevant records.
- The Better Auth 1.6.26 schema is reconciled with the committed Drizzle declarations and migration; upgrading Better Auth requires repeating that compatibility review.
- Active-workspace preference improves UX but is never trusted as proof.

## Alternatives rejected

- **Row Level Security as the only control:** potentially useful later, but serverless connection/session context and migration complexity do not replace application authorization.
- **Workspace ID from URL/cookie only:** trivially forgeable without membership proof.
- **UI/route-layout authorization only:** nested actions, jobs, and direct requests would bypass it.
- **Custom authentication:** unnecessary security and maintenance risk.
