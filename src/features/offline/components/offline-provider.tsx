"use client"

import type { ReactNode } from "react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { useRouter } from "next/navigation"
import { Dialog } from "radix-ui"
import { CloudOff, RefreshCw, TriangleAlert, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { QuestView } from "@/features/quests/domain/types"
import type {
  OfflineCreatePayload,
  OfflineMutation,
  OfflineMutationResult,
  OfflineScope,
} from "@/features/offline/domain/types"
import {
  cacheOfflineQuests,
  clearPrivateOfflineData,
  listOfflineMutations,
  markOfflineMutationConflict,
  queueOfflineMutation,
  removeOfflineMutation,
  retryOfflineMutationWithVersion,
  setActiveOfflineScope,
} from "@/features/offline/storage/offline-database"

type OfflineContextValue = Readonly<{
  conflicts: readonly OfflineMutation[]
  isOffline: boolean
  pendingCount: number
  queueCompletion: (quest: QuestView) => Promise<void>
  queueCreate: (formData: FormData) => Promise<QuestView>
  queueEdit: (quest: QuestView, formData: FormData) => Promise<void>
  queueTransition: (
    quest: QuestView,
    type: "delete" | "reopen",
  ) => Promise<void>
  refreshQueue: () => Promise<void>
  scope: OfflineScope
  snapshotQuests: (quests: readonly QuestView[]) => Promise<void>
}>

const OfflineContext = createContext<OfflineContextValue | null>(null)

function subscribeConnectivity(callback: () => void) {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}

function onlineSnapshot() {
  return navigator.onLine
}

function serverOnlineSnapshot() {
  return true
}

function createPayload(formData: FormData): OfflineCreatePayload {
  const value = (name: string) => String(formData.get(name) ?? "")
  return {
    description: value("description"),
    dueAt: value("dueAt"),
    parentTaskId: value("parentTaskId"),
    priority: value("priority") || "medium",
    projectId: value("projectId"),
    recurrenceRule: value("recurrenceRule"),
    startAt: value("startAt"),
    title: value("title").trim(),
  }
}

function optimisticQuest(id: string, payload: OfflineCreatePayload): QuestView {
  return {
    completedAt: null,
    deletedAt: null,
    description: payload.description.trim(),
    dueAt: null,
    gateName: null,
    id: `offline-${id}`,
    labels: [],
    parentTaskId: payload.parentTaskId || null,
    position: Number.MAX_SAFE_INTEGER,
    priority: payload.priority as QuestView["priority"],
    projectId: payload.projectId || null,
    recurrenceOccurrenceAt: null,
    recurrenceRule: payload.recurrenceRule.trim().toUpperCase() || null,
    recurrenceSequence: null,
    recurrenceSeriesId: null,
    recurrenceTimezone: null,
    startAt: null,
    status: "open",
    subquestCount: 0,
    title: payload.title,
    version: 1,
  }
}

function requestBackgroundSync() {
  // Encrypted mutations are replayed by this authenticated client after
  // unlock. The service worker never receives the local decryption key.
  return Promise.resolve()
}

async function postMutation(mutation: OfflineMutation) {
  const response = await fetch("/api/offline/mutations", {
    body: JSON.stringify({
      id: mutation.id,
      payload: mutation.payload,
      type: mutation.type,
      workspaceId: mutation.workspaceId,
    }),
    cache: "no-store",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error("AUTHORIZATION_REQUIRED")
  }

  const result = (await response.json()) as OfflineMutationResult
  if (
    result.status === "applied" ||
    result.status === "conflict" ||
    result.status === "rejected"
  ) {
    return result
  }

  throw new Error("SYNC_FAILED")
}

export function OfflineProvider({
  children,
  scope,
}: Readonly<{ children: ReactNode; scope: OfflineScope }>) {
  const router = useRouter()
  const online = useSyncExternalStore(
    subscribeConnectivity,
    onlineSnapshot,
    serverOnlineSnapshot,
  )
  const [mutations, setMutations] = useState<readonly OfflineMutation[]>([])
  const replaying = useRef(false)
  const replayAttempts = useRef(0)
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshQueue = useCallback(async () => {
    setMutations(await listOfflineMutations(scope.key))
  }, [scope.key])

  const replay = useCallback(
    async function replayPendingMutations() {
      if (!navigator.onLine || replaying.current) return
      replaying.current = true
      let applied = 0
      let retryTransientFailure = false

      try {
        const pending = (await listOfflineMutations(scope.key))
          .filter(({ status }) => status === "pending")
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt))

        for (const mutation of pending) {
          try {
            const result = await postMutation(mutation)
            if (result.status === "applied") {
              await removeOfflineMutation(mutation.id)
              applied += 1
            } else if (result.status === "conflict") {
              await markOfflineMutationConflict(mutation.id, result.conflict)
            } else {
              await markOfflineMutationConflict(mutation.id, {
                message: result.message,
                serverQuest: null,
              })
            }
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === "AUTHORIZATION_REQUIRED"
            ) {
              await clearPrivateOfflineData()
              toast.error(
                "Your session ended. Private offline data was cleared.",
              )
            } else {
              retryTransientFailure = navigator.onLine
            }
            break
          }
        }
      } finally {
        replaying.current = false
        await refreshQueue()
        if (applied > 0) {
          replayAttempts.current = 0
          toast.success(
            `${applied} offline change${applied === 1 ? "" : "s"} synchronized`,
          )
          router.refresh()
        }
        if (retryTransientFailure && replayAttempts.current < 5) {
          const delay = 500 * 2 ** replayAttempts.current
          replayAttempts.current += 1
          replayTimer.current = setTimeout(() => {
            replayTimer.current = null
            void replayPendingMutations()
          }, delay)
        }
      }
    },
    [refreshQueue, router, scope.key],
  )

  useEffect(() => {
    void setActiveOfflineScope(scope).then(refreshQueue)
  }, [refreshQueue, scope])

  useEffect(() => {
    if (online) {
      void replay()
    } else {
      replayAttempts.current = 0
      if (replayTimer.current) clearTimeout(replayTimer.current)
      replayTimer.current = null
    }
  }, [online, replay])

  useEffect(
    () => () => {
      if (replayTimer.current) clearTimeout(replayTimer.current)
    },
    [],
  )

  useEffect(() => {
    function synchronized(event: MessageEvent) {
      if (
        event.data !== "TRAKETO_OFFLINE_SYNCED" &&
        event.data !== "DAYMARK_OFFLINE_SYNCED"
      )
        return
      void refreshQueue()
      router.refresh()
    }
    navigator.serviceWorker?.addEventListener("message", synchronized)
    return () =>
      navigator.serviceWorker?.removeEventListener("message", synchronized)
  }, [refreshQueue, router])

  const value = useMemo<OfflineContextValue>(
    () => ({
      conflicts: mutations.filter(({ status }) => status === "conflict"),
      isOffline: !online,
      pendingCount: mutations.filter(({ status }) => status === "pending")
        .length,
      queueCompletion: async (quest) => {
        await queueOfflineMutation({
          conflict: null,
          createdAt: new Date().toISOString(),
          id: crypto.randomUUID(),
          payload: {
            expectedVersion: quest.version,
            questId: quest.id,
            title: quest.title,
          },
          scopeKey: scope.key,
          status: "pending",
          type: "complete",
          workspaceId: scope.workspaceId,
        })
        await refreshQueue()
        await requestBackgroundSync()
      },
      queueCreate: async (formData) => {
        const id = crypto.randomUUID()
        const payload = createPayload(formData)
        const quest = optimisticQuest(id, payload)
        await queueOfflineMutation({
          conflict: null,
          createdAt: new Date().toISOString(),
          id,
          optimisticQuest: quest,
          payload,
          scopeKey: scope.key,
          status: "pending",
          type: "create",
          workspaceId: scope.workspaceId,
        })
        await refreshQueue()
        await requestBackgroundSync()
        return quest
      },
      queueEdit: async (quest, formData) => {
        await queueOfflineMutation({
          conflict: null,
          createdAt: new Date().toISOString(),
          id: crypto.randomUUID(),
          payload: {
            ...createPayload(formData),
            expectedVersion: quest.version,
            questId: quest.id,
          },
          scopeKey: scope.key,
          status: "pending",
          type: "edit",
          workspaceId: scope.workspaceId,
        })
        await refreshQueue()
        await requestBackgroundSync()
      },
      queueTransition: async (quest, type) => {
        await queueOfflineMutation({
          conflict: null,
          createdAt: new Date().toISOString(),
          id: crypto.randomUUID(),
          payload: {
            expectedVersion: quest.version,
            questId: quest.id,
            title: quest.title,
          },
          scopeKey: scope.key,
          status: "pending",
          type,
          workspaceId: scope.workspaceId,
        })
        await refreshQueue()
        await requestBackgroundSync()
      },
      refreshQueue,
      scope,
      snapshotQuests: (quests) => cacheOfflineQuests(scope, quests),
    }),
    [mutations, online, refreshQueue, scope],
  )

  return (
    <OfflineContext.Provider value={value}>
      {children}
      <ConflictDialog conflicts={value.conflicts} replay={replay} />
    </OfflineContext.Provider>
  )
}

export function useOffline() {
  const value = useContext(OfflineContext)
  if (!value) throw new Error("useOffline must be used inside OfflineProvider")
  return value
}

export function OfflineStatusBar() {
  const { conflicts, isOffline, pendingCount } = useOffline()

  if (!isOffline && pendingCount === 0 && conflicts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="flex flex-wrap items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-xs text-warning"
      role="status"
    >
      {isOffline ? <CloudOff aria-hidden="true" className="size-4" /> : null}
      <span>
        {isOffline
          ? "Offline — recent tasks remain available on this device."
          : "Online"}
        {pendingCount > 0
          ? ` · ${pendingCount} change${pendingCount === 1 ? "" : "s"} queued`
          : ""}
        {conflicts.length > 0
          ? ` · ${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}`
          : ""}
      </span>
    </div>
  )
}

function ConflictDialog({
  conflicts,
  replay,
}: Readonly<{
  conflicts: readonly OfflineMutation[]
  replay: () => Promise<void>
}>) {
  const [open, setOpen] = useState(false)
  const { refreshQueue } = useOffline()

  if (conflicts.length === 0) return null

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Dialog.Trigger asChild>
        <Button className="fixed right-4 bottom-4 z-40" variant="destructive">
          <TriangleAlert aria-hidden="true" />
          Review offline conflicts
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 grid max-h-[80vh] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-panel border border-border-strong bg-popover p-5 shadow-float outline-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                Resolve offline conflicts
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-muted">
                Server versions are never overwritten silently. Keep the server
                state or explicitly apply your offline change to the latest
                version.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                aria-label="Close conflict review"
                size="icon-sm"
                variant="ghost"
              >
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          {conflicts.map((mutation) => (
            <section
              className="grid gap-3 rounded-control border border-border-soft bg-surface-inset p-4"
              key={mutation.id}
            >
              <div>
                <Badge variant="outline">{mutation.type}</Badge>
                <p className="mt-2 text-sm">{mutation.conflict?.message}</p>
                <p className="mt-2 rounded-control border border-border-soft bg-background/60 p-2 text-xs">
                  <strong>Your offline change:</strong>{" "}
                  {mutation.type === "create"
                    ? `Create “${mutation.payload.title}”`
                    : mutation.type === "edit"
                      ? `Update to “${mutation.payload.title}”`
                      : `${mutation.type} “${mutation.payload.title}”`}
                </p>
                {mutation.conflict?.serverQuest ? (
                  <p className="mt-1 text-xs text-ink-muted">
                    Server: {mutation.conflict.serverQuest.title} · v
                    {mutation.conflict.serverQuest.version} ·{" "}
                    {mutation.conflict.serverQuest.status}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={async () => {
                    await removeOfflineMutation(mutation.id)
                    await refreshQueue()
                  }}
                  variant="outline"
                >
                  Keep server state
                </Button>
                {mutation.type !== "create" &&
                mutation.conflict?.serverQuest ? (
                  <Button
                    onClick={async () => {
                      const version = mutation.conflict?.serverQuest?.version
                      if (!version) return
                      await retryOfflineMutationWithVersion(
                        mutation.id,
                        version,
                      )
                      await refreshQueue()
                      await replay()
                    }}
                  >
                    <RefreshCw aria-hidden="true" />
                    Apply my change to latest
                  </Button>
                ) : null}
              </div>
            </section>
          ))}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
