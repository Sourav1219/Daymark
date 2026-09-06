"use client"

import { useEffect, useState } from "react"
import {
  resolveClassification,
  formatTaskTypeLabel,
} from "@/features/quests/domain/classification"
import Link from "next/link"
import {
  CheckSquare,
  CloudOff,
  FolderTree,
  Globe,
  LockKeyhole,
  RotateCw,
  Tag,
  Trash2,
  User,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollableMain } from "@/components/shell/scrollable-main"
import { SystemMark } from "@/components/system/system-mark"
import { Input } from "@/components/ui/input"
import {
  gateAccentBadgeStyles,
  gateAccentDotStyles,
  gateAccentLabels,
} from "@/features/gates/components/gate-accent-styles"
import {
  labelColorBadgeStyles,
  labelColorDotStyles,
  labelColorLabels,
} from "@/features/labels/components/label-color-styles"
import {
  clearPrivateOfflineData,
  OfflineStorageLockedError,
  readOfflineFullState,
  unlockPrivateOfflineData,
} from "@/features/offline/storage/offline-database"

type OfflineFullStateResult = Awaited<ReturnType<typeof readOfflineFullState>>

export function OfflineQuestShell() {
  const [state, setState] = useState<OfflineFullStateResult>(null)
  const [loaded, setLoaded] = useState(false)
  const [locked, setLocked] = useState(false)
  const [passcode, setPasscode] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"tasks" | "gates" | "labels">(
    "tasks",
  )

  useEffect(() => {
    void readOfflineFullState()
      .then(setState)
      .catch((error) => {
        if (error instanceof OfflineStorageLockedError) setLocked(true)
      })
      .finally(() => setLoaded(true))
  }, [])

  async function unlock() {
    if (!(await unlockPrivateOfflineData(passcode))) {
      setMessage("The offline passcode is incorrect.")
      return
    }
    setLocked(false)
    setPasscode("")
    setState(await readOfflineFullState())
    setMessage(null)
  }

  async function clear() {
    await clearPrivateOfflineData()
    setState(null)
    setLocked(false)
    setMessage("Offline data was cleared from this device.")
  }

  const activeGates = state?.gates.filter((g) => !g.archivedAt) ?? []
  const archivedGates = state?.gates.filter((g) => Boolean(g.archivedAt)) ?? []

  return (
    <div className="app-stage">
      <div className="device-frame">
        <header className="device-header">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <SystemMark className="size-7" /> Traketo
          </span>
          <Badge
            className="text-warning border-warning/30 bg-warning/10"
            variant="outline"
          >
            <CloudOff aria-hidden="true" className="size-3 mr-1" /> Airplane
            Mode / Offline
          </Badge>
        </header>
        <ScrollableMain id="main-content">
          <div className="grid gap-section">
            <div>
              <p className="font-mono text-xs tracking-[0.22em] text-warning uppercase">
                Offline Autonomy Active
              </p>
              <h1 className="mt-2 text-page-title">Offline Workspace</h1>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Your tasks, project lists, tags, and settings are fully cached
                on this device for zero-latency offline access.
              </p>
            </div>

            {!loaded ? (
              <p role="status">Opening private device storage…</p>
            ) : locked ? (
              <Card>
                <CardHeader>
                  <CardTitle>Offline data is locked</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <p className="text-sm text-ink-muted">
                    Enter the local passcode created when offline access was
                    enabled.
                  </p>
                  <Input
                    aria-label="Offline passcode"
                    autoComplete="off"
                    onChange={(event) => setPasscode(event.target.value)}
                    type="password"
                    value={passcode}
                  />
                  <Button
                    disabled={passcode.length === 0}
                    onClick={unlock}
                    type="button"
                  >
                    <LockKeyhole aria-hidden="true" /> Unlock offline data
                  </Button>
                  {message ? (
                    <p className="text-sm text-warning" role="alert">
                      {message}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : !state ? (
              <Card>
                <CardHeader>
                  <CardTitle>No offline snapshot saved yet</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-ink-muted">
                  Open Traketo once while online to save an encrypted snapshot
                  of your workspace onto this phone.
                </CardContent>
              </Card>
            ) : (
              <>
                {/* User Profile Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-border-soft bg-surface-inset/60 p-3.5 text-xs text-ink-muted">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-system-blue/20 font-semibold text-spectral-cyan">
                      {state.profile?.userName ? (
                        state.profile.userName.charAt(0).toUpperCase()
                      ) : (
                        <User className="size-3.5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-ink">
                        {state.profile?.userName ?? state.scope.userName}
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        {state.profile?.workspaceName ??
                          state.scope.workspaceName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {state.profile?.timezone ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] gap-1 py-0.5"
                      >
                        <Globe className="size-2.5" />
                        {state.profile.timezone}
                      </Badge>
                    ) : null}
                    <span className="text-[11px]">
                      {state.updatedAt
                        ? `Saved ${new Date(state.updatedAt).toLocaleDateString()}`
                        : "Queued changes"}
                    </span>
                  </div>
                </div>

                {state.pendingCount > 0 || state.conflicts.length > 0 ? (
                  <p className="rounded-control border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                    {state.pendingCount} queued · {state.conflicts.length}{" "}
                    conflicted. Changes will synchronize once you reconnect.
                  </p>
                ) : null}

                {/* Tab Navigation Controls for Android */}
                <div
                  aria-label="Offline sections"
                  className="flex rounded-control border border-border-soft bg-surface-inset p-1 gap-1"
                  role="tablist"
                >
                  <button
                    aria-selected={activeTab === "tasks"}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-medium transition-all ${
                      activeTab === "tasks"
                        ? "bg-surface-elevated text-ink shadow-sm"
                        : "text-ink-muted hover:text-ink"
                    }`}
                    onClick={() => setActiveTab("tasks")}
                    role="tab"
                    type="button"
                  >
                    <CheckSquare className="size-3.5" />
                    Tasks ({state.quests.length})
                  </button>
                  <button
                    aria-selected={activeTab === "gates"}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-medium transition-all ${
                      activeTab === "gates"
                        ? "bg-surface-elevated text-ink shadow-sm"
                        : "text-ink-muted hover:text-ink"
                    }`}
                    onClick={() => setActiveTab("gates")}
                    role="tab"
                    type="button"
                  >
                    <FolderTree className="size-3.5" />
                    Lists ({state.gates.length})
                  </button>
                  <button
                    aria-selected={activeTab === "labels"}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-medium transition-all ${
                      activeTab === "labels"
                        ? "bg-surface-elevated text-ink shadow-sm"
                        : "text-ink-muted hover:text-ink"
                    }`}
                    onClick={() => setActiveTab("labels")}
                    role="tab"
                    type="button"
                  >
                    <Tag className="size-3.5" />
                    Labels ({state.labels.length})
                  </button>
                </div>

                {/* TAB 1: Tasks */}
                {activeTab === "tasks" && (
                  <section
                    aria-labelledby="offline-tasks-heading"
                    className="grid gap-3"
                  >
                    <h2 className="sr-only" id="offline-tasks-heading">
                      Offline Tasks
                    </h2>
                    {state.quests.length === 0 ? (
                      <p className="text-sm text-ink-muted text-center py-6">
                        No active tasks were present in the last saved snapshot.
                      </p>
                    ) : (
                      state.quests.map((quest) => (
                        <Card key={quest.id}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">
                              {quest.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="flex flex-wrap items-center gap-2 pt-0">
                            <span className="w-full text-sm text-ink-muted">
                              {formatTaskTypeLabel(
                                resolveClassification(quest),
                              )}
                            </span>
                            <Badge variant="outline">{quest.priority}</Badge>
                            <Badge variant="outline">v{quest.version}</Badge>
                            {quest.gateName ? (
                              <Badge
                                variant="outline"
                                className="border-system-blue/40 text-spectral-cyan"
                              >
                                {quest.gateName}
                              </Badge>
                            ) : null}
                            {quest.id.startsWith("offline-") ? (
                              <Badge className="text-warning" variant="outline">
                                Queued creation
                              </Badge>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </section>
                )}

                {/* TAB 2: Lists / Gates */}
                {activeTab === "gates" && (
                  <section
                    aria-labelledby="offline-gates-heading"
                    className="grid gap-3"
                  >
                    <h2 className="sr-only" id="offline-gates-heading">
                      Offline Lists
                    </h2>
                    {state.gates.length === 0 ? (
                      <p className="text-sm text-ink-muted text-center py-6">
                        No Lists cached yet. Visit Lists while online to sync.
                      </p>
                    ) : (
                      <>
                        <div className="grid gap-3">
                          {activeGates.map((gate) => (
                            <Card key={gate.id}>
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span
                                      aria-hidden="true"
                                      className={`size-2.5 shrink-0 rounded-full ${gateAccentDotStyles[gate.accentToken] ?? "bg-system-blue"}`}
                                    />
                                    <CardTitle className="text-base">
                                      {gate.name}
                                    </CardTitle>
                                  </div>
                                  <Badge
                                    className={
                                      gateAccentBadgeStyles[gate.accentToken] ??
                                      ""
                                    }
                                    variant="outline"
                                  >
                                    {gateAccentLabels[gate.accentToken] ??
                                      "List"}
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-0 text-xs text-ink-muted">
                                <span>
                                  {gate.description || "No description"}
                                </span>
                                <span className="font-mono">
                                  {gate.questCount} task
                                  {gate.questCount === 1 ? "" : "s"}
                                </span>
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        {archivedGates.length > 0 ? (
                          <div className="mt-4 border-t border-border-soft pt-4">
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                              Archived Lists ({archivedGates.length})
                            </h3>
                            <div className="grid gap-2">
                              {archivedGates.map((gate) => (
                                <div
                                  key={gate.id}
                                  className="flex items-center justify-between rounded-control border border-border-soft p-2.5 text-xs text-ink-muted"
                                >
                                  <span>{gate.name}</span>
                                  <span className="font-mono">
                                    {gate.questCount} tasks
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </section>
                )}

                {/* TAB 3: Labels */}
                {activeTab === "labels" && (
                  <section
                    aria-labelledby="offline-labels-heading"
                    className="grid gap-3"
                  >
                    <h2 className="sr-only" id="offline-labels-heading">
                      Offline Labels
                    </h2>
                    {state.labels.length === 0 ? (
                      <p className="text-sm text-ink-muted text-center py-6">
                        No Labels cached yet. Visit Labels while online to sync.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {state.labels.map((label) => (
                          <div
                            key={label.id}
                            className="flex items-center justify-between gap-2 rounded-panel border border-border-soft bg-card/78 p-3 shadow-panel"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className={`size-2.5 shrink-0 rounded-full ${labelColorDotStyles[label.colorToken] ?? "bg-system-blue"}`}
                              />
                              <span className="text-sm font-medium">
                                {label.name}
                              </span>
                            </div>
                            <Badge
                              className={
                                labelColorBadgeStyles[label.colorToken] ?? ""
                              }
                              variant="outline"
                            >
                              {labelColorLabels[label.colorToken] ?? "Label"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            <Button asChild>
              <Link href="/quests">
                <RotateCw aria-hidden="true" /> Try reconnecting
              </Link>
            </Button>
            <Button onClick={clear} type="button" variant="outline">
              <Trash2 aria-hidden="true" /> Clear offline data
            </Button>
            {message && !locked ? (
              <p className="text-sm text-ink-muted" role="status">
                {message}
              </p>
            ) : null}
          </div>
        </ScrollableMain>
      </div>
    </div>
  )
}
