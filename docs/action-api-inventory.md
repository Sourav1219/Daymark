# Action and API inventory

This inventory separates implemented authentication, Quest organisation, interaction, recurrence, reminder, and offline replay mutations from later product mutations. Changes to ownership or transport require documentation updates.

## Common Server Action contract

All application UI mutations use Server Actions with the shape:

```ts
type ActionResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false
      readonly error: {
        readonly code:
          | "AUTHENTICATION_REQUIRED"
          | "CONFLICT"
          | "FORBIDDEN"
          | "INTERNAL_ERROR"
          | "NOT_FOUND"
          | "RATE_LIMITED"
          | "STORAGE_UNAVAILABLE"
          | "VALIDATION_ERROR"
        readonly message: string
        readonly fieldErrors?: Readonly<Record<string, readonly string[]>>
      }
    }
```

Expected failures use this union. Actions never return a raw database/Auth exception, stack trace, credential, or provider payload. Every action resolves the session, Zod-validates input, creates `AccessContext`, invokes authorization-aware application services, and revalidates after a successful commit. Mutable-record updates include `expectedVersion`.

## Implemented Server Actions

| Feature        | Action           | Validated input                           | Behavior                                                        |
| -------------- | ---------------- | ----------------------------------------- | --------------------------------------------------------------- |
| Authentication | `registerAction` | name, normalized email, 12–128 password   | Better Auth registration, secure session, personal provisioning |
| Authentication | `loginAction`    | normalized email, bounded password        | Better Auth credential validation and session creation          |
| Authentication | `logoutAction`   | authenticated request headers, no payload | Better Auth session revocation and cookie removal               |

| Feature | Action                  | Validated input                                         | Behavior                                                          |
| ------- | ----------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| Quests  | `createQuestAction`     | fields plus optional Gate and parent Quest IDs          | Creates an authorized open Quest or bounded Subquest              |
| Quests  | `editQuestAction`       | Quest ID, expected version, fields, Gate and parent IDs | Applies a tenant/version edit with placement and cycle checks     |
| Quests  | `completeQuestAction`   | Quest ID, expected version                              | Completes once and atomically creates the next recurring instance |
| Quests  | `reopenQuestAction`     | Quest ID, expected version                              | Returns a cleared Quest to open status and clears completion time |
| Quests  | `softDeleteQuestAction` | Quest ID, expected version                              | Sets deletion time and retains the record for recovery            |
| Quests  | `restoreQuestAction`    | Quest ID, expected version                              | Clears deletion time after an authorized version check            |

| Feature | Action                 | Validated input                                   | Behavior                                                         |
| ------- | ---------------------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| Gates   | `createGateAction`     | name, description, accent token                   | Creates a workspace-scoped active Gate                           |
| Gates   | `editGateAction`       | Gate ID, expected version, editable fields        | Version-predicated Gate edit                                     |
| Gates   | `archiveGateAction`    | Gate ID, expected version                         | Archives without deleting or detaching Quests                    |
| Gates   | `restoreGateAction`    | Gate ID, expected version                         | Restores an archived Gate                                        |
| Gates   | `softDeleteGateAction` | Gate ID, expected version                         | Soft-deletes only when no live Quest is assigned                 |
| Labels  | `createLabelAction`    | name, color token                                 | Creates a workspace-scoped Label                                 |
| Labels  | `editLabelAction`      | Label ID, expected version, editable fields       | Version-predicated Label edit                                    |
| Labels  | `deleteLabelAction`    | Label ID, expected version                        | Soft-deletes the Label; assignments disappear from active reads  |
| Labels  | `setQuestLabelsAction` | Quest ID, expected version, up to 20 distinct IDs | Atomically replaces assignments and increments the Quest version |

| Feature       | Action                       | Validated input                               | Behavior                                                       |
| ------------- | ---------------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| Settings      | `updateTimezoneAction`       | IANA timezone, expected version               | Updates user timezone and synchronizes the personal workspace  |
| Reminders     | `createReminderAction`       | Quest ID, local schedule, channel             | Creates an authorized future schedule                          |
| Reminders     | `updateReminderAction`       | reminder ID, schedule patch, expected version | Updates a pending schedule with optimistic conflict protection |
| Reminders     | `cancelReminderAction`       | reminder ID, expected version                 | Cancels safely; repeated terminal cancellation is idempotent   |
| Notifications | `markNotificationReadAction` | notification ID, expected version             | Marks the current user's in-app notification read              |

| Feature     | Action                            | Validated input                                 | Behavior                                                                 |
| ----------- | --------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| Attachments | `requestAttachmentUploadAction`   | Quest ID, allowlisted declared type, byte count | Creates pending metadata and returns a five-minute staging PUT           |
| Attachments | `finalizeAttachmentUploadAction`  | attachment ID and upload receipt                | Inspects stored length/magic bytes and conditionally promotes to private |
| Attachments | `requestAttachmentDownloadAction` | attachment ID                                   | Rechecks membership and returns a 60-second ready-object GET             |
| Attachments | `deleteAttachmentAction`          | attachment ID and expected version              | Rechecks authorization and removes object through a retry-safe lifecycle |

Expected validation and credential failures return safe `ActionFailure` state. Redirects are restricted to local paths. Better Auth's `nextCookies` integration is last in the plugin chain so Server Actions can write response cookies.

## Planned Server Actions

| Feature    | Action                   | Validated command/result                                 | Transaction and authorization notes                                         |
| ---------- | ------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| Workspaces | `createWorkspaceAction`  | name, timezone → workspace summary                       | Creates workspace, owner membership, and activity event atomically          |
| Workspaces | `renameWorkspaceAction`  | workspaceId, name, expectedVersion → summary             | Owner/admin; context workspace must equal target                            |
| Workspaces | `switchWorkspaceAction`  | workspaceId → active-workspace acknowledgement           | Requires active membership; updates trusted preference/session metadata     |
| Workspaces | `inviteMemberAction`     | workspaceId, normalized email, role → invitation summary | Owner/admin; rate limited; later notification is idempotent                 |
| Workspaces | `changeMemberRoleAction` | memberId, role, expectedVersion → member summary         | Owner-only invariants prevent removing/demoting final owner                 |
| Workspaces | `removeMemberAction`     | memberId, expectedVersion → removed id                   | Owner/admin policy; membership soft delete and event in one transaction     |
| Gates      | `reorderGatesAction`     | ordered ids + expected versions → order                  | All IDs proven in workspace; bounded list; one transaction                  |
| Quests     | `reorderQuestsAction`    | ordered active ids + expected versions → order           | Implemented: exact bounded workspace scope, version checks, one transaction |

Authentication sign-in/sign-up/reset operations follow Better Auth's protocol through its single Route Handler or documented server API integration; the application does not recreate credential handling.

## Service-owned mutations without UI actions

- Progression has no client-authored score action. Quest domain services calculate points/rank/streaks from verified transitions.
- Activity events have no public create/update/delete action. Mutation services append allow-listed event types and versioned payloads.
- Reminder delivery is owned by the signed scheduled Route Handler, not a user action.
- Attachment cleanup is owned by the signed scheduled Route Handler. User upload, finalization, authorized download, and deletion are Server Actions backed by the same attachment services.

## Route Handler API inventory

| Endpoint                         | Input validation                                                 | Success                                       | Expected safe failures                   | Idempotency                                                                |
| -------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| `GET /api/health`                | none                                                             | `200 { service, status, timestamp }`          | process-level `5xx`                      | safe GET; not cached                                                       |
| `GET/POST /api/auth/[...all]`    | Better Auth                                                      | protocol-defined                              | Better Auth safe protocol response       | Better Auth contract                                                       |
| `POST /api/offline/mutations`    | Strict discriminated create/complete command + same-origin check | applied Quest ID/version or explicit conflict | `400`, `401`, `403`, `409`, `413`, `422` | client UUID stored with Quest; repeated replay returns the existing result |
| `GET/POST /api/cron/reminders`   | Bearer secret + optional bounded batch                           | claimed/delivered/retried/failed counts       | `401`, `503`, generic `500`              | unique delivery key, transactional claim, provider key                     |
| `GET/POST /api/cron/attachments` | Bearer secret                                                    | cleaned/failed counts                         | `401`, `503`, generic `500`              | terminal metadata states and missing-object-safe deletion                  |

Any future external API is versioned, separately authorized, rate-limited, documented, and justified by a real non-UI consumer. It must call the same feature services rather than bypass them.
