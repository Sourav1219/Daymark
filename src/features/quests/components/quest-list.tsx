"use client"

import type { KeyboardEvent } from "react"
import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react"
import { useRouter } from "next/navigation"
import {
  ArchiveRestore,
  CalendarClock,
  Check,
  CircleCheckBig,
  CornerDownRight,
  ListChecks,
  PanelsTopLeft,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { ConfirmationDialog } from "@/components/system/confirmation-dialog"
import { EmptyState } from "@/components/system/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AttachmentManager } from "@/features/attachments/components/attachment-manager"
import type { AttachmentView } from "@/features/attachments/domain/types"
import {
  completeQuestAction,
  permanentlyDeleteQuestAction,
  reopenQuestAction,
  reorderQuestsAction,
  restoreQuestAction,
  softDeleteQuestAction,
  type QuestTransitionInput,
} from "@/features/quests/application/actions"
import { QuestEditForm } from "@/features/quests/components/quest-edit-form"
import { useTaskCompletionCelebration } from "@/features/quests/components/task-completion-celebration-provider"
import type {
  QuestGateOption,
  QuestParentOption,
} from "@/features/quests/components/quest-form-fields"
import { QuestLabelControl } from "@/features/quests/components/quest-label-control"
import { QuestOrderControls } from "@/features/quests/components/quest-order-controls"
import { RestoreQuestScheduleDialog } from "@/features/quests/components/restore-quest-schedule-dialog"
import { QuestSubquestForm } from "@/features/quests/components/quest-subquest-form"
import {
  TaskDeletedPopup,
  type DeletedTaskNotice,
} from "@/features/quests/components/task-deleted-popup"
import {
  TaskRestoredPopup,
  type RestoredTaskNotice,
} from "@/features/quests/components/task-restored-popup"
import { maxSubquestDepth } from "@/features/quests/domain/subquest-depth"
import type { QuestPriority, QuestView } from "@/features/quests/domain/types"
import type { ActionResult } from "@/lib/actions/action-result"
import type { QuestMutationSummary } from "@/features/quests/mutations/quest-mutation-service"
import { localDateForInstant } from "@/features/progression/domain/progression"
import {
  defaultTimezone,
  formatZonedDateTime,
} from "@/features/reminders/domain/timezone"
import { useOffline } from "@/features/offline/components/offline-provider"

type QuestListMode = "active" | "cleared" | "deleted" | "search" | "today"

export type QuestLabelOption = Readonly<{
  id: string
  name: string
  colorToken: string
}>

type QuestListProps = Readonly<{
  attachmentsByQuest?: Readonly<Record<string, readonly AttachmentView[]>>
  emptyDescription: string
  emptyTitle: string
  gates?: readonly QuestGateOption[] | undefined
  labels?: readonly QuestLabelOption[] | undefined
  mode: QuestListMode
  parentOptions?: readonly QuestParentOption[] | undefined
  quests: readonly QuestView[]
  referenceNow?: string
  reorderable?: boolean | undefined
  storageAvailable?: boolean
  timezone?: string | undefined
}>

type QuestListEntry = QuestView & Readonly<{ optimistic?: boolean }>

type QuestOptimisticAction =
  | Readonly<{ questId: string; type: "complete" }>
  | Readonly<{ quests: readonly QuestListEntry[]; type: "reorder" }>

const priorityStyles: Record<QuestPriority, string> = {
  critical: "border-danger/40 bg-danger/10 text-danger",
  high: "border-warning/40 bg-warning/10 text-warning",
  low: "border-success/40 bg-success/10 text-success",
  medium: "border-system-blue/40 bg-system-blue/10 text-spectral-cyan",
}

const labelBadgeStyles: Record<string, string> = {
  "mana-violet": "border-mana-violet/40 bg-mana-violet/10 text-mana-violet",
  "spectral-cyan":
    "border-spectral-cyan/40 bg-spectral-cyan/10 text-spectral-cyan",
  "status-danger": "border-danger/40 bg-danger/10 text-danger",
  "status-success": "border-success/40 bg-success/10 text-success",
  "status-warning": "border-warning/40 bg-warning/10 text-warning",
  "system-blue": "border-system-blue/40 bg-system-blue/10 text-spectral-cyan",
}

const fallbackLabelBadgeStyle =
  "border-border-strong bg-surface-inset text-ink-muted"

function questStatusLabel(status: QuestView["status"]) {
  if (status === "completed") return "Cleared"
  if (status === "failed") return "Missed"
  return "Open"
}

function emptyIcon(mode: QuestListMode) {
  if (mode === "cleared") {
    return <CircleCheckBig aria-hidden="true" className="size-6" />
  }

  if (mode === "deleted") {
    return <ArchiveRestore aria-hidden="true" className="size-6" />
  }

  if (mode === "today") {
    return <CalendarClock aria-hidden="true" className="size-6" />
  }

  return <ListChecks aria-hidden="true" className="size-6" />
}

function resultToast(
  result: ActionResult<QuestMutationSummary>,
  successMessage: string,
) {
  if (result.ok) {
    toast.success(successMessage)
  } else {
    toast.error(result.error.message)
  }
}

function progressionMutationMessage(
  result: ActionResult<QuestMutationSummary>,
  baseMessage: string,
  positiveVerb: string,
) {
  if (!result.ok || !result.data.progression?.xpDelta) return baseMessage
  const delta = result.data.progression.xpDelta

  return delta < 0
    ? `${baseMessage}; ${Math.abs(delta)} points reversed`
    : `${baseMessage}; ${delta} points ${positiveVerb}`
}

function QuestFeedback({
  announcement,
}: Readonly<{
  announcement: string
}>) {
  return (
    <>
      <p
        aria-atomic="true"
        aria-live="polite"
        className="sr-only"
        role="status"
      >
        {announcement}
      </p>
    </>
  )
}

function StraightMutationButton({
  input,
  kind,
  onRestored,
  quest,
  title,
}: Readonly<{
  input: QuestTransitionInput
  kind: "reopen" | "restore"
  onRestored?: (task: RestoredTaskNotice) => void
  quest: QuestView
  title?: string
}>) {
  const [isPending, startTransition] = useTransition()
  const { queueTransition } = useOffline()

  function runMutation() {
    startTransition(async () => {
      try {
        if (!navigator.onLine && kind === "reopen") {
          await queueTransition(quest, "reopen")
          toast.success("Task reopen queued for reconnection")
          return
        }
        const result =
          kind === "reopen"
            ? await reopenQuestAction(input)
            : await restoreQuestAction(input)
        if (result.ok && kind === "restore" && title) {
          onRestored?.({ id: result.data.id, title })
        }
        if (kind === "restore" && result.ok) return

        resultToast(
          result,
          progressionMutationMessage(
            result,
            kind === "reopen"
              ? "Task returned to the active list"
              : "Task restored",
            "restored",
          ),
        )
      } catch {
        toast.error(
          "The task request could not be completed. Refresh and retry.",
        )
      }
    })
  }

  return (
    <Button disabled={isPending} onClick={runMutation} variant="outline">
      {kind === "reopen" ? (
        <RotateCcw aria-hidden="true" />
      ) : (
        <ArchiveRestore aria-hidden="true" />
      )}
      {isPending
        ? kind === "reopen"
          ? "Reopening"
          : "Restoring"
        : kind === "reopen"
          ? "Reopen Task"
          : "Restore Task"}
    </Button>
  )
}

function DeleteQuestControl({
  input,
  quest,
  title,
}: Readonly<{
  input: QuestTransitionInput
  quest: QuestView
  title: string
}>) {
  const [isPending, startTransition] = useTransition()
  const { queueTransition } = useOffline()

  function deleteQuest() {
    startTransition(async () => {
      try {
        if (!navigator.onLine) {
          await queueTransition(quest, "delete")
          toast.success("Task deletion queued for reconnection")
          return
        }
        const result = await softDeleteQuestAction(input)
        resultToast(
          result,
          progressionMutationMessage(result, "Task moved to Trash", "awarded"),
        )
      } catch {
        toast.error("The task could not be moved. Refresh and retry.")
      }
    })
  }

  return (
    <ConfirmationDialog
      confirmLabel={isPending ? "Moving task" : "Move to Trash"}
      description={`“${title}” will leave active views but can be restored from Trash.`}
      onConfirm={deleteQuest}
      title="Move this task to Trash?"
      triggerLabel="Delete Task"
      variant="destructive"
    />
  )
}

function PermanentlyDeleteQuestControl({
  input,
  onDeleted,
  title,
}: Readonly<{
  input: QuestTransitionInput
  onDeleted: (task: DeletedTaskNotice) => void
  title: string
}>) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function permanentlyDelete() {
    startTransition(async () => {
      try {
        if (!navigator.onLine) {
          toast.error(
            "Connect to the internet before permanently deleting a task.",
          )
          return
        }

        const result = await permanentlyDeleteQuestAction(input)
        if (!result.ok) {
          toast.error(result.error.message)
          return
        }

        onDeleted({ id: result.data.id, kind: "permanent", title })
        router.refresh()
      } catch {
        toast.error("The task could not be deleted. Refresh and retry.")
      }
    })
  }

  return (
    <ConfirmationDialog
      appearance="permanent-delete"
      confirmLabel={isPending ? "Deleting forever" : "Delete forever"}
      description={`“${title}” will be removed from Trash and cannot be restored.`}
      onConfirm={permanentlyDelete}
      title="Delete this task forever?"
      triggerLabel="Delete Task"
      variant="destructive"
    />
  )
}

function QuestDates({
  quest,
  timezone,
}: Readonly<{ quest: QuestView; timezone: string }>) {
  if (!quest.startAt && !quest.dueAt && !quest.completedAt) {
    return null
  }

  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted">
      {quest.startAt ? (
        <div className="flex gap-1.5">
          <dt>Starts</dt>
          <dd>
            <time dateTime={quest.startAt}>
              {formatZonedDateTime(new Date(quest.startAt), timezone)}
            </time>
          </dd>
        </div>
      ) : null}
      {quest.dueAt ? (
        <div className="flex gap-1.5">
          <dt>Due</dt>
          <dd>
            <time dateTime={quest.dueAt}>
              {formatZonedDateTime(new Date(quest.dueAt), timezone)}
            </time>
          </dd>
        </div>
      ) : null}
      {quest.completedAt ? (
        <div className="flex gap-1.5">
          <dt>Cleared</dt>
          <dd>
            <time dateTime={quest.completedAt}>
              {formatZonedDateTime(new Date(quest.completedAt), timezone)}
            </time>
          </dd>
        </div>
      ) : null}
    </dl>
  )
}

type QuestCardProps = Readonly<{
  canMoveDown: boolean
  canMoveUp: boolean
  completionPending: boolean
  depth: number
  dragged: boolean
  gates?: readonly QuestGateOption[] | undefined
  labels?: readonly QuestLabelOption[] | undefined
  mode: QuestListMode
  onComplete: (quest: QuestView) => void
  onMoveDown: () => void
  onMoveUp: () => void
  onOrderPointerDown: () => void
  onPermanentlyDeleted: (task: DeletedTaskNotice) => void
  onRestored: (task: RestoredTaskNotice) => void
  parentOptions?: readonly QuestParentOption[] | undefined
  quest: QuestListEntry
  reorderable: boolean
  attachments: readonly AttachmentView[]
  storageAvailable: boolean
  timezone: string
  referenceNow: string
}>

function QuestCard({
  attachments,
  canMoveDown,
  canMoveUp,
  completionPending,
  depth,
  dragged,
  gates,
  labels,
  mode,
  onComplete,
  onMoveDown,
  onMoveUp,
  onOrderPointerDown,
  onPermanentlyDeleted,
  onRestored,
  parentOptions,
  quest,
  referenceNow,
  reorderable,
  storageAvailable,
  timezone,
}: QuestCardProps) {
  const titleId = `quest-${quest.id}-title`
  const input = { expectedVersion: quest.version, questId: quest.id }
  const [manageOpen, setManageOpen] = useState(false)
  const canAddSubquest =
    (mode === "active" || mode === "search" || mode === "today") &&
    depth < maxSubquestDepth
  const restorable =
    quest.deletedAt !== null &&
    localDateForInstant(new Date(quest.deletedAt), timezone) ===
      localDateForInstant(new Date(referenceNow), timezone)

  if (mode === "deleted") {
    return (
      <Card
        aria-labelledby={titleId}
        className="quest-card trash-task-card"
        data-priority={quest.priority}
        data-quest-id={quest.id}
        role="article"
      >
        <CardContent className="trash-task-card__body">
          <header className="trash-task-card__header">
            <div className="trash-task-card__identity">
              <span className="trash-task-card__icon" aria-hidden="true">
                <Trash2 />
              </span>
              <div>
                <span className="trash-task-card__eyebrow">Trash</span>
                <strong>
                  {restorable ? "Ready to recover" : "Recovery expired"}
                </strong>
              </div>
            </div>
            <div className="trash-task-card__tags">
              <Badge
                className={priorityStyles[quest.priority]}
                variant="outline"
              >
                {quest.priority}
              </Badge>
              <span className="trash-task-card__version">v{quest.version}</span>
            </div>
          </header>

          <section className="trash-task-card__summary">
            <div>
              <CardTitle id={titleId}>{quest.title}</CardTitle>
              {quest.description ? <p>{quest.description}</p> : null}
            </div>
          </section>

          <div className="trash-task-card__meta">
            {quest.deletedAt ? (
              <div className="trash-task-card__moved">
                <span aria-hidden="true">
                  <Trash2 />
                </span>
                <div>
                  <strong>Moved to Trash</strong>
                  <time dateTime={quest.deletedAt}>
                    {formatZonedDateTime(new Date(quest.deletedAt), timezone)}
                  </time>
                </div>
              </div>
            ) : null}
            <QuestDates quest={quest} timezone={timezone} />
          </div>

          <footer className="trash-task-card__recovery">
            <div className="trash-task-card__recovery-copy">
              <span aria-hidden="true" className="trash-task-card__status" />
              <div>
                <strong>
                  {restorable
                    ? "Restorable until midnight"
                    : "Restore window expired"}
                </strong>
                <span>
                  {restorable
                    ? "Restore with a new timeline or remove this task permanently."
                    : "This task can still be permanently removed from Trash."}
                </span>
              </div>
            </div>
            <div
              className="trash-task-card__actions"
              data-layout={restorable ? "paired" : "single"}
            >
              {restorable ? (
                <RestoreQuestScheduleDialog
                  input={input}
                  onRestored={onRestored}
                  referenceNow={referenceNow}
                  timezone={timezone}
                  title={quest.title}
                />
              ) : null}
              <PermanentlyDeleteQuestControl
                input={input}
                onDeleted={onPermanentlyDeleted}
                title={quest.title}
              />
            </div>
          </footer>
        </CardContent>
      </Card>
    )
  }

  if (mode === "search") {
    return (
      <Card
        aria-labelledby={titleId}
        className="quest-card quest-card--search-result"
        data-priority={quest.priority}
        data-quest-id={quest.id}
        role="article"
      >
        <CardContent className="quest-search-card">
          <div className="quest-search-card__topline">
            <span className="quest-search-card__icon" aria-hidden="true">
              <Search />
            </span>
            <span>Search result</span>
            <span className="quest-search-card__version">v{quest.version}</span>
          </div>

          <div className="quest-search-card__heading">
            <div>
              <CardTitle id={titleId}>{quest.title}</CardTitle>
              {quest.description ? <p>{quest.description}</p> : null}
            </div>
            <div className="quest-search-card__badges">
              <Badge
                className={priorityStyles[quest.priority]}
                variant="outline"
              >
                {quest.priority} priority
              </Badge>
              <Badge variant="outline">{questStatusLabel(quest.status)}</Badge>
              {quest.parentTaskId ? (
                <Badge variant="outline">Subtask</Badge>
              ) : null}
              {quest.gateName ? (
                <Badge
                  className="border-mana-violet/40 bg-mana-violet/10 text-mana-violet"
                  variant="outline"
                >
                  {quest.gateName}
                </Badge>
              ) : null}
              {quest.recurrenceRule ? (
                <Badge variant="outline">Recurring</Badge>
              ) : null}
              {quest.labels.map((label) => (
                <Badge
                  className={
                    labelBadgeStyles[label.colorToken] ??
                    fallbackLabelBadgeStyle
                  }
                  key={label.id}
                  variant="outline"
                >
                  {label.name}
                </Badge>
              ))}
            </div>
          </div>

          {quest.startAt || quest.dueAt ? (
            <div className="quest-search-card__schedule">
              <CalendarClock aria-hidden="true" />
              <QuestDates quest={quest} timezone={timezone} />
            </div>
          ) : null}

          <div className="quest-search-card__actions">
            {quest.status === "open" ? (
              <Button
                aria-label={`Complete ${quest.title}`}
                disabled={completionPending || quest.optimistic}
                onClick={() => onComplete(quest)}
              >
                <Check aria-hidden="true" />
                Complete
              </Button>
            ) : null}

            {!quest.optimistic ? (
              <>
                <Button
                  aria-expanded={manageOpen}
                  className="quest-search-card__manage"
                  onClick={() => setManageOpen((current) => !current)}
                  type="button"
                  variant="outline"
                >
                  <SlidersHorizontal aria-hidden="true" />
                  Manage
                </Button>
                {manageOpen ? (
                  <div className="quest-search-card__manage-panel">
                    <QuestEditForm
                      gates={gates}
                      parentOptions={parentOptions}
                      quest={quest}
                      timezone={timezone}
                    />
                    {labels ? (
                      <QuestLabelControl labels={labels} quest={quest} />
                    ) : null}
                    {canAddSubquest ? (
                      <details>
                        <summary>Add Subtask</summary>
                        <QuestSubquestForm
                          gates={gates}
                          parentQuest={quest}
                          timezone={timezone}
                        />
                      </details>
                    ) : null}
                    <DeleteQuestControl
                      input={input}
                      quest={quest}
                      title={quest.title}
                    />
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      aria-labelledby={titleId}
      className={`quest-card border-border-soft bg-card/78 shadow-panel ${
        dragged ? "opacity-55 ring-2 ring-system-blue" : ""
      }`}
      data-priority={quest.priority}
      data-quest-id={quest.id}
      role="article"
    >
      <CardHeader className="border-b border-border-soft pb-4">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg" id={titleId}>
              {quest.title}
            </CardTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge
                className={priorityStyles[quest.priority]}
                variant="outline"
              >
                {quest.priority} priority
              </Badge>
              <Badge variant="outline">{questStatusLabel(quest.status)}</Badge>
              {quest.parentTaskId ? (
                <Badge variant="outline">
                  <CornerDownRight aria-hidden="true" className="size-3" />
                  Subtask
                </Badge>
              ) : null}
              {quest.subquestCount > 0 ? (
                <Badge variant="outline">
                  {quest.subquestCount} subtask
                  {quest.subquestCount === 1 ? "" : "s"}
                </Badge>
              ) : null}
              {quest.gateName ? (
                <Badge
                  className="border-mana-violet/40 bg-mana-violet/10 text-mana-violet"
                  variant="outline"
                >
                  <PanelsTopLeft aria-hidden="true" className="size-3" />
                  {quest.gateName}
                </Badge>
              ) : null}
              {quest.recurrenceRule ? (
                <Badge variant="outline">
                  <CalendarClock aria-hidden="true" className="size-3" />
                  Recurring
                </Badge>
              ) : null}
              {quest.labels.map((label) => (
                <Badge
                  className={
                    labelBadgeStyles[label.colorToken] ??
                    fallbackLabelBadgeStyle
                  }
                  key={label.id}
                  variant="outline"
                >
                  {label.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 self-start">
            {quest.optimistic ? (
              <Badge aria-label="Task is saving" variant="outline">
                Saving
              </Badge>
            ) : null}
            <span className="font-mono text-xs text-ink-muted">
              v{quest.version}
            </span>
            {reorderable && !quest.optimistic ? (
              <QuestOrderControls
                canMoveDown={canMoveDown}
                canMoveUp={canMoveUp}
                disabled={completionPending}
                onMoveDown={onMoveDown}
                onMoveUp={onMoveUp}
                onPointerDown={onOrderPointerDown}
                title={quest.title}
              />
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {quest.description ? (
          <p className="leading-6 text-ink-muted whitespace-pre-wrap">
            {quest.description}
          </p>
        ) : null}
        <QuestDates quest={quest} timezone={timezone} />

        {!quest.optimistic ? (
          <AttachmentManager
            attachments={attachments}
            canUpload
            key={attachments
              .map(({ id, version }) => `${id}:${version}`)
              .join("|")}
            questId={quest.id}
            storageAvailable={storageAvailable}
          />
        ) : null}

        {!quest.optimistic ? (
          <QuestEditForm
            gates={gates}
            parentOptions={parentOptions}
            quest={quest}
            timezone={timezone}
          />
        ) : null}

        {labels && !quest.optimistic ? (
          <QuestLabelControl labels={labels} quest={quest} />
        ) : null}

        {canAddSubquest && !quest.optimistic ? (
          <details>
            <summary className="motion-interactive w-fit cursor-pointer rounded-control px-2 py-1 text-sm font-medium text-system-blue hover:text-spectral-cyan focus-visible:outline-none">
              Add Subtask
            </summary>
            <QuestSubquestForm
              gates={gates}
              parentQuest={quest}
              timezone={timezone}
            />
          </details>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-border-soft pt-4">
          {(mode === "active" || mode === "today") &&
          quest.status === "open" ? (
            <Button
              aria-label={`Complete ${quest.title}`}
              disabled={completionPending || quest.optimistic}
              onClick={() => onComplete(quest)}
            >
              <Check aria-hidden="true" />
              Complete Task
            </Button>
          ) : null}
          {mode === "cleared" ? (
            <StraightMutationButton input={input} kind="reopen" quest={quest} />
          ) : null}
          {!quest.optimistic ? (
            <DeleteQuestControl
              input={input}
              quest={quest}
              title={quest.title}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function actualQuestDepth(
  quest: QuestView,
  parentsById: ReadonlyMap<string, QuestParentOption>,
): number {
  let parentId = quest.parentTaskId
  let depth = 0
  const visited = new Set<string>()

  while (parentId && depth < maxSubquestDepth) {
    if (visited.has(parentId)) {
      return maxSubquestDepth
    }

    visited.add(parentId)
    depth += 1
    const parent = parentsById.get(parentId)

    if (!parent && depth < maxSubquestDepth) {
      return maxSubquestDepth
    }

    parentId = parent?.parentTaskId ?? null
  }

  return depth
}

export function QuestList({
  attachmentsByQuest = {},
  emptyDescription,
  emptyTitle,
  gates,
  labels,
  mode,
  parentOptions,
  quests,
  referenceNow = new Date().toISOString(),
  reorderable = false,
  storageAvailable = false,
  timezone = defaultTimezone,
}: QuestListProps) {
  const router = useRouter()
  const [completionPending, startCompletion] = useTransition()
  const [reorderPending, startReorder] = useTransition()
  const [announcement, setAnnouncement] = useState("")
  const [restoredTask, setRestoredTask] = useState<RestoredTaskNotice | null>(
    null,
  )
  const [permanentlyDeletedTask, setPermanentlyDeletedTask] =
    useState<DeletedTaskNotice | null>(null)
  const [draggedQuestId, setDraggedQuestId] = useState<string | null>(null)
  const [offlineCompletedIds, setOfflineCompletedIds] = useState<
    ReadonlySet<string>
  >(new Set())
  const draggedQuestIdRef = useRef<string | null>(null)
  const { queueCompletion } = useOffline()
  const showCompletion = useTaskCompletionCelebration()
  const visibleBaseQuests = quests.filter(
    ({ id }) => !offlineCompletedIds.has(id),
  )
  const [optimisticQuests, applyOptimisticAction] = useOptimistic(
    visibleBaseQuests,
    (current, action: QuestOptimisticAction) =>
      action.type === "complete"
        ? current.filter((quest) => quest.id !== action.questId)
        : [...action.quests],
  )
  useEffect(() => {
    function finishPointerOrder() {
      draggedQuestIdRef.current = null
      setDraggedQuestId(null)
    }

    window.addEventListener("pointerup", finishPointerOrder)
    window.addEventListener("pointercancel", finishPointerOrder)
    return () => {
      window.removeEventListener("pointerup", finishPointerOrder)
      window.removeEventListener("pointercancel", finishPointerOrder)
    }
  }, [])

  function completeQuestOptimistically(quest: QuestView) {
    startCompletion(async () => {
      applyOptimisticAction({ questId: quest.id, type: "complete" })
      setAnnouncement(`${quest.title} is being completed.`)

      try {
        if (!navigator.onLine) {
          await queueCompletion(quest)
          setOfflineCompletedIds((current) => new Set(current).add(quest.id))
          toast.success("Task completion queued for reconnection")
          setAnnouncement(
            `${quest.title} was completed locally and queued for synchronization.`,
          )
          return
        }

        const result = await completeQuestAction({
          expectedVersion: quest.version,
          questId: quest.id,
        })
        if (result.ok) {
          const progression = result.data.progression
          const progressionMessage = progression
            ? ` ${progression.xpDelta} points earned.`
            : ""
          setAnnouncement(`${quest.title} completed.${progressionMessage}`)
          showCompletion({
            currentStreak: progression?.currentStreak,
            id: result.data.id,
            streakIncreased: progression?.streakIncreased,
            title: quest.title,
            timezone: progression?.timezone,
            version: result.data.version,
            xpEarned: progression?.xpDelta ?? 0,
          })
        } else {
          toast.error(result.error.message)
          setAnnouncement(
            `${quest.title} was not completed. The task was restored to the list.`,
          )
          router.refresh()
        }
      } catch {
        toast.error("The task could not be completed. Refresh and retry.")
        setAnnouncement(
          `${quest.title} was not completed. The task was restored to the list.`,
        )
        router.refresh()
      }
    })
  }

  function siblingQuests(quest: QuestListEntry) {
    return optimisticQuests.filter(
      ({ parentTaskId }) => parentTaskId === quest.parentTaskId,
    )
  }

  function moveQuest(sourceId: string, targetId: string) {
    if (!reorderable || reorderPending || sourceId === targetId) return

    const source = optimisticQuests.find(({ id }) => id === sourceId)
    const target = optimisticQuests.find(({ id }) => id === targetId)

    if (!source || !target || source.parentTaskId !== target.parentTaskId) {
      setAnnouncement("Tasks can only move within their current subtask level.")
      return
    }

    const sourceIndex = optimisticQuests.findIndex(({ id }) => id === sourceId)
    const targetIndex = optimisticQuests.findIndex(({ id }) => id === targetId)
    const previous = [...optimisticQuests]
    const next = [...optimisticQuests]
    const [moved] = next.splice(sourceIndex, 1)

    if (!moved) return
    next.splice(targetIndex, 0, moved)

    startReorder(async () => {
      applyOptimisticAction({ quests: next, type: "reorder" })
      setAnnouncement(`${source.title} moved. Saving order.`)

      try {
        const result = await reorderQuestsAction({
          quests: next.map(({ id, version }) => ({
            expectedVersion: version,
            questId: id,
          })),
        })

        if (result.ok) {
          toast.success("Task order saved")
          setAnnouncement(`${source.title} moved and its order was saved.`)
        } else {
          applyOptimisticAction({ quests: previous, type: "reorder" })
          toast.error(result.error.message)
          setAnnouncement(
            `${source.title} was not moved. The previous order was restored.`,
          )
          router.refresh()
        }
      } catch {
        applyOptimisticAction({ quests: previous, type: "reorder" })
        toast.error(
          "The task order could not be saved. The previous order was restored.",
        )
        setAnnouncement(
          `${source.title} was not moved. The previous order was restored.`,
        )
        router.refresh()
      }
    })
  }

  function moveQuestByOffset(quest: QuestListEntry, offset: -1 | 1) {
    const siblings = siblingQuests(quest)
    const index = siblings.findIndex(({ id }) => id === quest.id)
    const target = siblings[index + offset]

    if (target) moveQuest(quest.id, target.id)
  }

  function handleQuestKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    quest: QuestListEntry,
  ) {
    const target = event.target as HTMLElement
    const interactiveTarget = target.closest(
      "a, button, input, select, summary, textarea",
    )

    if (
      event.key.toLowerCase() !== "c" ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      interactiveTarget ||
      mode === "cleared" ||
      mode === "deleted" ||
      quest.optimistic
    ) {
      return
    }

    event.preventDefault()
    completeQuestOptimistically(quest)
  }

  if (optimisticQuests.length === 0) {
    return (
      <>
        {restoredTask ? (
          <TaskRestoredPopup
            onDismiss={() => setRestoredTask(null)}
            task={restoredTask}
          />
        ) : null}
        {permanentlyDeletedTask ? (
          <TaskDeletedPopup
            onDismiss={() => setPermanentlyDeletedTask(null)}
            task={permanentlyDeletedTask}
          />
        ) : null}
        <QuestFeedback announcement={announcement} />
        <EmptyState
          description={emptyDescription}
          icon={emptyIcon(mode)}
          title={emptyTitle}
          variant={mode === "deleted" ? "trash" : "default"}
        />
      </>
    )
  }

  const questIds = new Set(optimisticQuests.map((quest) => quest.id))
  const parentsById = new Map(
    parentOptions?.map((parent) => [parent.id, parent]) ?? [],
  )
  const childrenByParent = new Map<string, QuestListEntry[]>()
  const roots: QuestListEntry[] = []

  for (const quest of optimisticQuests) {
    if (quest.parentTaskId && questIds.has(quest.parentTaskId)) {
      const siblings = childrenByParent.get(quest.parentTaskId) ?? []
      siblings.push(quest)
      childrenByParent.set(quest.parentTaskId, siblings)
    } else {
      roots.push(quest)
    }
  }

  function renderQuest(quest: QuestListEntry) {
    const children = childrenByParent.get(quest.id) ?? []
    const siblings = siblingQuests(quest)
    const siblingIndex = siblings.findIndex(({ id }) => id === quest.id)

    return (
      <div
        data-quest-order-id={quest.id}
        key={quest.id}
        onPointerUp={() => {
          const sourceId = draggedQuestIdRef.current
          if (sourceId) moveQuest(sourceId, quest.id)
          draggedQuestIdRef.current = null
          setDraggedQuestId(null)
        }}
        onKeyDown={(event) => handleQuestKeyDown(event, quest)}
        role="listitem"
        tabIndex={quest.optimistic ? undefined : 0}
      >
        <div className="grid gap-4">
          <QuestCard
            attachments={attachmentsByQuest[quest.id] ?? []}
            canMoveDown={siblingIndex < siblings.length - 1}
            canMoveUp={siblingIndex > 0}
            completionPending={completionPending || reorderPending}
            depth={actualQuestDepth(quest, parentsById)}
            dragged={draggedQuestId === quest.id}
            gates={gates}
            labels={labels}
            mode={mode}
            onComplete={completeQuestOptimistically}
            onMoveDown={() => moveQuestByOffset(quest, 1)}
            onMoveUp={() => moveQuestByOffset(quest, -1)}
            onOrderPointerDown={() => {
              draggedQuestIdRef.current = quest.id
              setDraggedQuestId(quest.id)
            }}
            onPermanentlyDeleted={setPermanentlyDeletedTask}
            onRestored={setRestoredTask}
            parentOptions={parentOptions}
            quest={quest}
            referenceNow={referenceNow}
            reorderable={reorderable}
            storageAvailable={storageAvailable}
            timezone={timezone}
          />
          {children.length > 0 ? (
            <div className="grid gap-4 border-border-soft pl-4" role="list">
              {children.map(renderQuest)}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <>
      {restoredTask ? (
        <TaskRestoredPopup
          onDismiss={() => setRestoredTask(null)}
          task={restoredTask}
        />
      ) : null}
      {permanentlyDeletedTask ? (
        <TaskDeletedPopup
          onDismiss={() => setPermanentlyDeletedTask(null)}
          task={permanentlyDeletedTask}
        />
      ) : null}
      <QuestFeedback announcement={announcement} />
      <div
        aria-busy={completionPending || reorderPending}
        className="grid gap-4"
        role="list"
      >
        {roots.map(renderQuest)}
      </div>
    </>
  )
}
