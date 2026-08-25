"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CloudOff, LockKeyhole, RotateCw, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollableMain } from "@/components/shell/scrollable-main"
import { SystemMark } from "@/components/system/system-mark"
import { Input } from "@/components/ui/input"
import {
  clearPrivateOfflineData,
  OfflineStorageLockedError,
  readOfflineQuestState,
  unlockPrivateOfflineData,
} from "@/features/offline/storage/offline-database"

type OfflineState = Awaited<ReturnType<typeof readOfflineQuestState>>

export function OfflineQuestShell() {
  const [state, setState] = useState<OfflineState>(null)
  const [loaded, setLoaded] = useState(false)
  const [locked, setLocked] = useState(false)
  const [passcode, setPasscode] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void readOfflineQuestState()
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
    setState(await readOfflineQuestState())
    setMessage(null)
  }

  async function clear() {
    await clearPrivateOfflineData()
    setState(null)
    setLocked(false)
    setMessage("Offline data was cleared from this device.")
  }

  return (
    <div className="app-stage">
      <div className="device-frame">
        <header className="device-header">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <SystemMark className="size-7" /> Traketo
          </span>
          <Badge className="text-warning" variant="outline">
            <CloudOff aria-hidden="true" className="size-3" /> Offline
          </Badge>
        </header>
        <ScrollableMain id="main-content">
          <div className="grid gap-section">
            <div>
              <p className="font-mono text-xs tracking-[0.22em] text-warning uppercase">
                Offline
              </p>
              <h1 className="mt-2 text-page-title">Offline tasks</h1>
              <p className="mt-3 text-sm leading-6 text-ink-muted">
                This read-only shell contains only the latest task snapshot
                saved for the signed-in device. Queued supported changes replay
                after reconnection.
              </p>
            </div>

            {!loaded ? (
              <p role="status">Opening private browser storage…</p>
            ) : locked ? (
              <Card>
                <CardHeader>
                  <CardTitle>Offline data is locked</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <p className="text-sm text-ink-muted">
                    Enter the local passcode created when offline access was
                    enabled. Authentication data is never stored here.
                  </p>
                  <Input
                    aria-label="Offline passcode"
                    autoComplete="off"
                    onChange={(event) => setPasscode(event.target.value)}
                    type="password"
                    value={passcode}
                  />
                  <Button
                    disabled={passcode.length < 6}
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
                  <CardTitle>No offline task snapshot</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-ink-muted">
                  Visit the authenticated task list once while online before
                  relying on offline access.
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                  <span>{state.scope.workspaceName}</span>
                  <span>
                    {state.updatedAt
                      ? `Saved ${new Date(state.updatedAt).toLocaleString()}`
                      : "Queued changes only"}
                  </span>
                </div>
                {state.pendingCount > 0 || state.conflicts.length > 0 ? (
                  <p className="rounded-control border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                    {state.pendingCount} queued · {state.conflicts.length}{" "}
                    conflicted. Reconnect and open Traketo to synchronize or
                    resolve them.
                  </p>
                ) : null}
                <section
                  aria-labelledby="offline-list-heading"
                  className="grid gap-3"
                >
                  <h2
                    className="text-xl font-semibold"
                    id="offline-list-heading"
                  >
                    Recent active tasks
                  </h2>
                  {state.quests.length === 0 ? (
                    <p className="text-sm text-ink-muted">
                      No active tasks were present in the last saved snapshot.
                    </p>
                  ) : (
                    state.quests.map((quest) => (
                      <Card key={quest.id}>
                        <CardHeader>
                          <CardTitle className="text-base">
                            {quest.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{quest.priority}</Badge>
                          <Badge variant="outline">v{quest.version}</Badge>
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
