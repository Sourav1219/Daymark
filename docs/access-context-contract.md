# AccessContext repository contract

Status: enforced for the Phase 2 workspace boundary and every Phase 4–5 Quest, Gate, Label, placement, assignment, and discovery repository operation.

## Contract

`AccessContext` is the immutable proof passed from server authorization into every user-owned query or mutation:

```ts
type AccessContext = Readonly<{
  userId: string
  workspaceId: string
  role: "owner" | "admin" | "member"
}>
```

Only `requireWorkspaceAccess` may construct this context for an application request. It first validates the complete Better Auth session, then resolves an active membership joined to a non-deleted workspace. A route parameter, cookie workspace preference, resource ID, or client-authored object never creates authority.

## Repository rule

Every future repository operation over user-owned data must accept `AccessContext` explicitly. Its SQL must re-apply both sides of the boundary:

1. Predicate the resource on `access.workspaceId`.
2. Prove `access.userId` has an active membership in that workspace, either in the same statement or through a repository boundary lookup immediately followed by a context-predicated statement.
3. Exclude soft-deleted membership, workspace, and resource rows.
4. Apply role or ownership rules in the application service and include them in SQL when they affect the rows that may change.
5. Never expose an unscoped `getById`, `updateById`, or `deleteById` method for user-owned records.

The preferred shape is:

```ts
async function getResource(
  database: Database,
  access: AccessContext,
  resourceId: string,
): Promise<Resource | null>
```

`getWorkspaceSummary` is the Phase 2 reference. Phase 4–5 repositories apply the same rule to every list, resource lookup, versioned update, soft deletion, restoration, Gate/parent placement, and Label assignment. Writes include the tenant-owned row's `workspace_id`, opaque resource ID, active membership proof, and `expectedVersion` where applicable.

## Narrow bootstrap exceptions

Two operations happen before an `AccessContext` can exist and are explicitly not general repository APIs:

- Better Auth persists its own user, account, session, and verification protocol records.
- The post-registration provisioner receives the newly created Better Auth user ID and atomically creates that user's single personal workspace and owner membership.

Authorization-boundary lookup functions accept an authenticated `userId` plus a requested `workspaceId` only to create `AccessContext`; they return no product data. No future feature repository may copy this exception.

## Entry-point and denial behavior

- Missing or expired session: `requireUser` terminates with the application 401 state.
- Authenticated user without active membership: `requireWorkspaceAccess` terminates with the application 403 state.
- Future opaque resource lookups should normally return `NOT_FOUND` after a valid context so resource existence is not disclosed across workspaces.
- Proxy cookie inspection is navigation optimization only. It never replaces the full server session and membership checks.

## Mandatory tests for every future repository

Use at least two users and two workspaces. Prove allowed same-workspace access, denied cross-workspace access, denied access after membership/workspace soft deletion, and no access when only a valid opaque resource ID is supplied. Mutation tests must also prove the tenant predicates are present in the write statement and that transactional failures roll back all dependent rows. The Quest integration suite is the first complete implementation of this contract and also verifies stale-version conflicts.
