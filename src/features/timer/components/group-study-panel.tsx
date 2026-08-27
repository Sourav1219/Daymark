"use client"

import { useEffect, useState, useTransition } from "react"
import {
  Ban,
  Check,
  Clock3,
  Copy,
  Crown,
  DoorOpen,
  Lock,
  LockOpen,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createGroupStudyAction,
  joinGroupStudyAction,
  moderateGroupStudyParticipantAction,
  regenerateGroupStudyJoinCodeAction,
  respondToJoinRequestAction,
  setGroupStudyJoinLockedAction,
  updateGroupStudySettingsAction,
} from "@/features/timer/application/actions"
import { calculateTimerElapsedMs } from "@/features/timer/domain/timer"
import { groupStudySnapshotChanged } from "@/features/timer/domain/group-study-sync"
import type {
  GroupStudyActivityView,
  GroupStudyHistoryView,
  GroupStudyJoinRequestView,
  GroupStudyParticipantView,
  GroupStudySessionView,
} from "@/features/timer/domain/types"
import { formatDate, formatTimeFull } from "@/lib/formatting/date"

function formatParticipantClock(
  participant: GroupStudyParticipantView,
  nowMs: number,
) {
  const totalSeconds = Math.floor(
    calculateTimerElapsedMs({
      accumulatedMs: participant.accumulatedMs,
      lastStartedAt: participant.lastStartedAt,
      nowMs,
      status: participant.status,
    }) / 1_000,
  )
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":")
}

function formatActivityTime(isoDate: string, timezone: string) {
  return formatTimeFull(new Date(isoDate), timezone)
}

function formatHistoryDate(isoDate: string, timezone: string) {
  return formatDate(new Date(isoDate), timezone)
}

function initials(name: string) {
  return name
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function activityCopy(activity: GroupStudyActivityView) {
  switch (activity.action) {
    case "joined":
      return "joined and started focusing"
    case "paused":
      return "paused their timer"
    case "resumed":
      return "resumed their timer"
    case "left":
      return "stopped and left the room"
    case "removed":
      return "was removed by the host"
    case "blocked":
      return "was blocked and removed by the host"
  }
}

function formatCompactDuration(durationMs: number) {
  const totalMinutes = Math.floor(durationMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}

export function GroupStudyPanel({
  hasActiveTimer,
  nowMs,
  onTimerStarted,
  pendingJoinRequest,
  sharedHistory,
  sharedSession,
  timezone,
}: Readonly<{
  hasActiveTimer: boolean
  nowMs: number
  onTimerStarted: (subject: string) => void
  pendingJoinRequest: GroupStudyJoinRequestView | null
  sharedHistory: readonly GroupStudyHistoryView[]
  sharedSession: GroupStudySessionView | null
  timezone: string
}>) {
  const router = useRouter()
  const [roomName, setRoomName] = useState("")
  const [subject, setSubject] = useState("")
  const [participantLimit, setParticipantLimit] = useState<number | string>(8)
  const [joinCode, setJoinCode] = useState("")
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Version-diff polling: fetch the lightweight group-poll endpoint while the
  // tab is visible. Stable rooms back off so they do not compete with page
  // rendering for database capacity.
  // Only call router.refresh() when the room version actually changes, reducing
  // unnecessary full-page renders.
  useEffect(() => {
    if (!sharedSession) return
    let lastVersion = sharedSession.version
    let lastParticipantCount = sharedSession.participants.length
    let stableCount = 0

    const events = new EventSource(
      `/api/timer/group-events?roomId=${encodeURIComponent(sharedSession.id)}`,
    )
    events.addEventListener("room-changed", () => {
      stableCount = 0
      router.refresh()
    })

    const poll = async () => {
      if (document.visibilityState !== "visible") return

      try {
        const response = await fetch(
          `/api/timer/group-poll?roomId=${sharedSession.id}`,
          { credentials: "same-origin" },
        )
        if (!response.ok) return
        const data = (await response.json()) as {
          participantCount: number
          version: number
          status: string
        }
        if (data.status !== "active") {
          // Room closed — force refresh to show the closed state.
          router.refresh()
          return
        }
        if (
          groupStudySnapshotChanged(
            {
              participantCount: lastParticipantCount,
              version: lastVersion,
            },
            data,
          )
        ) {
          lastVersion = data.version
          lastParticipantCount = data.participantCount
          stableCount = 0
          router.refresh()
        } else {
          stableCount++
        }
      } catch {
        // Network error — silently skip this poll.
      }
    }

    // Start responsively, then back off once the room is stable.
    const getInterval = () => (stableCount >= 2 ? 15_000 : 5_000)
    let timeout: number
    const schedule = () => {
      timeout = window.setTimeout(
        async () => {
          await poll()
          schedule()
        },
        document.visibilityState === "visible" ? getInterval() : 15_000,
      )
    }
    schedule()
    const handleVisibilityChange = () => {
      window.clearTimeout(timeout)
      if (document.visibilityState === "visible") stableCount = 0
      schedule()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      events.close()
      window.clearTimeout(timeout)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [router, sharedSession])

  // Heartbeat: ping /api/timer/heartbeat every 60 s while in an active room
  // so the server knows this tab is still alive.
  useEffect(() => {
    if (!sharedSession) return
    const sendHeartbeat = () =>
      fetch("/api/timer/heartbeat", {
        credentials: "same-origin",
        method: "POST",
      }).catch(() => undefined)

    // Send immediately on mount, then every 60 s.
    void sendHeartbeat()
    const interval = window.setInterval(sendHeartbeat, 60_000)
    return () => window.clearInterval(interval)
  }, [sharedSession])

  function createRoom() {
    startTransition(async () => {
      const result = await createGroupStudyAction({
        name: roomName,
        participantLimit: Number(participantLimit),
        subject,
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      setRoomName("")
      setSubject("")
      onTimerStarted(result.data.subject)
      router.refresh()
    })
  }

  function joinRoom() {
    startTransition(async () => {
      const result = await joinGroupStudyAction({ joinCode })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      setJoinCode("")
      // When the room is locked, the response is a pending request (no subject).
      if (result.data.status !== "joined") {
        toast.info("Your request to join has been sent to the host.")
        router.refresh()
        return
      }
      onTimerStarted(result.data.subject)
      router.refresh()
    })
  }

  async function copyCode() {
    if (!sharedSession) return
    await navigator.clipboard.writeText(sharedSession.joinCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_600)
  }

  return (
    <section aria-labelledby="group-study-heading" className="group-study">
      <div className="timer-section-heading group-study__heading">
        <div>
          <p>Study together</p>
          <h2 id="group-study-heading">Group Study</h2>
        </div>
        <span className="group-study__heading-icon" aria-hidden="true">
          <Users />
        </span>
      </div>

      {sharedSession ? (
        <ActiveGroupStudyRoom
          copied={copied}
          key={`${sharedSession.id}:${sharedSession.version}`}
          nowMs={nowMs}
          onCopy={copyCode}
          session={sharedSession}
          timezone={timezone}
        />
      ) : pendingJoinRequest ? (
        <div className="group-study-room">
          <div className="group-study-room__topline">
            <div>
              <span className="group-study-room__live">
                <Clock3 aria-hidden="true" /> Pending request
              </span>
              <h3>Waiting for host</h3>
              <p>
                Your request to join the room has been sent to the host for
                approval.
              </p>
            </div>
          </div>
          <Button onClick={() => router.refresh()} variant="outline">
            <RefreshCw aria-hidden="true" /> Check status
          </Button>
        </div>
      ) : (
        <div className="group-study__lobby">
          <div className="group-study__intro">
            <span aria-hidden="true">
              <Sparkles />
            </span>
            <div>
              <h3>Open a shared focus room</h3>
              <p>
                Study together while every person keeps complete control of
                their own timer.
              </p>
            </div>
          </div>

          <div className="group-study__lobby-grid">
            <form
              className="group-study__form"
              onSubmit={(event) => {
                event.preventDefault()
                createRoom()
              }}
            >
              <span className="group-study__form-icon" aria-hidden="true">
                <Users />
              </span>
              <div>
                <h3>Create a room</h3>
                <p>Choose the shared study topic and invite your people.</p>
              </div>
              <label htmlFor="group-study-name">Room name</label>
              <Input
                autoComplete="off"
                disabled={hasActiveTimer || isPending}
                id="group-study-name"
                maxLength={80}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="e.g. Finals focus room"
                required
                value={roomName}
              />
              <label htmlFor="group-study-subject">Study objective</label>
              <Input
                autoComplete="off"
                disabled={hasActiveTimer || isPending}
                id="group-study-subject"
                maxLength={160}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="e.g. Physics revision"
                required
                value={subject}
              />
              <label htmlFor="group-study-limit">Participant limit</label>
              <Input
                disabled={hasActiveTimer || isPending}
                id="group-study-limit"
                max={20}
                min={2}
                onChange={(event) =>
                  setParticipantLimit(
                    event.target.value === "" ? "" : Number(event.target.value),
                  )
                }
                required
                type="number"
                value={participantLimit}
              />
              <Button
                className="group-study__join-button"
                disabled={hasActiveTimer || isPending}
                type="submit"
              >
                <Play aria-hidden="true" /> Create &amp; start
              </Button>
            </form>

            <span className="group-study__divider">or</span>

            <form
              className="group-study__form"
              onSubmit={(event) => {
                event.preventDefault()
                joinRoom()
              }}
            >
              <span
                className="group-study__form-icon group-study__form-icon--join"
                aria-hidden="true"
              >
                <UserPlus />
              </span>
              <div>
                <h3>Join with a code</h3>
                <p>Enter the active room code shared by another student.</p>
              </div>
              <label htmlFor="group-study-code">Room code</label>
              <Input
                autoCapitalize="characters"
                autoComplete="off"
                className="group-study__code-input"
                disabled={hasActiveTimer || isPending}
                id="group-study-code"
                maxLength={8}
                onChange={(event) =>
                  setJoinCode(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^23456789A-HJ-NP-Z]/gu, ""),
                  )
                }
                placeholder="8-CHAR CODE"
                required
                value={joinCode}
              />
              <Button
                disabled={hasActiveTimer || isPending}
                type="submit"
                variant="outline"
              >
                <DoorOpen aria-hidden="true" /> Join room
              </Button>
            </form>
          </div>

          {hasActiveTimer ? (
            <p className="group-study__busy-note">
              <Clock3 aria-hidden="true" /> Finish your current timer before
              creating or joining a room.
            </p>
          ) : null}
        </div>
      )}

      {sharedHistory.length > 0 ? (
        <GroupStudyHistory history={sharedHistory} timezone={timezone} />
      ) : null}
    </section>
  )
}

function GroupStudyHistory({
  history,
  timezone,
}: Readonly<{
  history: readonly GroupStudyHistoryView[]
  timezone: string
}>) {
  return (
    <div className="group-study-history">
      <div className="group-study-room__section-title">
        <div>
          <Clock3 aria-hidden="true" />
          <h4>Today&apos;s shared rooms</h4>
        </div>
        <span>{history.length} sessions</span>
      </div>
      <div className="group-study-history__list">
        {history.map((room) => (
          <details className="group-study-history__card" key={room.id}>
            <summary>
              <span aria-hidden="true">
                <Users />
              </span>
              <div>
                <strong>{room.name}</strong>
                <p>
                  {room.subject} · {formatHistoryDate(room.joinedAt, timezone)}
                </p>
              </div>
              <small>
                {room.endedAt
                  ? formatCompactDuration(room.totalFocusMs)
                  : "Still active"}
              </small>
            </summary>
            {room.endedAt ? (
              <div className="group-study-summary">
                <div className="group-study-summary__heading">
                  <span aria-hidden="true">
                    <ShieldCheck />
                  </span>
                  <div>
                    <strong>Final room summary</strong>
                    <p>Completed after everyone left the room.</p>
                  </div>
                </div>
                <div className="group-study-summary__metrics">
                  <div>
                    <span>Total focus</span>
                    <strong>{formatCompactDuration(room.totalFocusMs)}</strong>
                  </div>
                  <div>
                    <span>Room duration</span>
                    <strong>
                      {formatCompactDuration(room.durationMs ?? 0)}
                    </strong>
                  </div>
                  <div>
                    <span>Participants</span>
                    <strong>{room.participants.length}</strong>
                  </div>
                </div>
                <div className="group-study-summary__people">
                  {room.participants.map((participant) => (
                    <div key={`${room.id}:${participant.userId}`}>
                      <span>{initials(participant.name)}</span>
                      <strong>{participant.name}</strong>
                      <small>
                        {formatCompactDuration(participant.totalMs)}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="group-study-summary__pending">
                The final summary will appear after the last participant leaves.
              </p>
            )}
            <ol className="group-study-room__activity">
              {room.activities.map((activity) => (
                <li data-action={activity.action} key={activity.id}>
                  <span aria-hidden="true" />
                  <p>
                    <strong>{activity.name}</strong> {activityCopy(activity)}
                  </p>
                  <time dateTime={activity.occurredAt}>
                    {formatActivityTime(activity.occurredAt, timezone)}
                  </time>
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </div>
  )
}

function ActiveGroupStudyRoom({
  copied,
  nowMs,
  onCopy,
  session,
  timezone,
}: Readonly<{
  copied: boolean
  nowMs: number
  onCopy: () => void
  session: GroupStudySessionView
  timezone: string
}>) {
  const router = useRouter()
  const [name, setName] = useState(session.name)
  const [subject, setSubject] = useState(session.subject)
  const [participantLimit, setParticipantLimit] = useState<number | string>(
    session.participantLimit,
  )
  const [isPending, startTransition] = useTransition()

  function saveSettings() {
    startTransition(async () => {
      const result = await updateGroupStudySettingsAction({
        name,
        participantLimit: Number(participantLimit),
        roomId: session.id,
        subject,
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      router.refresh()
    })
  }

  function toggleLock() {
    startTransition(async () => {
      const result = await setGroupStudyJoinLockedAction({
        joinLocked: !session.joinLocked,
        roomId: session.id,
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      router.refresh()
    })
  }

  function regenerateCode() {
    startTransition(async () => {
      const result = await regenerateGroupStudyJoinCodeAction({
        roomId: session.id,
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      router.refresh()
    })
  }

  function moderate(
    participant: GroupStudyParticipantView,
    action: "blocked" | "removed",
  ) {
    startTransition(async () => {
      const result = await moderateGroupStudyParticipantAction({
        action,
        participantId: participant.id,
        roomId: session.id,
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="group-study-room">
      <div className="group-study-room__topline">
        <div>
          <span className="group-study-room__live">
            <Radio aria-hidden="true" /> Live room
          </span>
          <h3>{session.name}</h3>
          <p>{session.subject}</p>
        </div>
        <button
          aria-label={`Copy Group Study code ${session.joinCode}`}
          className="group-study-room__code"
          onClick={onCopy}
          type="button"
        >
          <span>{session.joinLocked ? "Room locked" : "Join code"}</span>
          <strong>{session.joinCode}</strong>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </button>
      </div>

      {session.isHost ? (
        <div className="group-study-host-controls">
          <div className="group-study-host-controls__title">
            <div>
              <Crown aria-hidden="true" />
              <strong>Host controls</strong>
            </div>
            <span>Only visible to you</span>
          </div>
          <form
            className="group-study-host-controls__settings"
            onSubmit={(event) => {
              event.preventDefault()
              saveSettings()
            }}
          >
            <label htmlFor="active-group-study-name">Room name</label>
            <Input
              disabled={isPending}
              id="active-group-study-name"
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
            <label htmlFor="active-group-study-objective">Objective</label>
            <Input
              disabled={isPending}
              id="active-group-study-objective"
              maxLength={160}
              onChange={(event) => setSubject(event.target.value)}
              required
              value={subject}
            />
            <label htmlFor="active-group-study-limit">Limit</label>
            <Input
              disabled={isPending}
              id="active-group-study-limit"
              max={20}
              min={Math.max(2, session.participants.length)}
              onChange={(event) =>
                setParticipantLimit(
                  event.target.value === "" ? "" : Number(event.target.value),
                )
              }
              required
              type="number"
              value={participantLimit}
            />
            <Button disabled={isPending} type="submit" variant="outline">
              <Save aria-hidden="true" /> Save
            </Button>
          </form>
          <div className="group-study-host-controls__access">
            <button disabled={isPending} onClick={toggleLock} type="button">
              {session.joinLocked ? (
                <LockOpen aria-hidden="true" />
              ) : (
                <Lock aria-hidden="true" />
              )}
              {session.joinLocked ? "Unlock room" : "Lock room"}
            </button>
            <button disabled={isPending} onClick={regenerateCode} type="button">
              <RefreshCw aria-hidden="true" /> New join code
            </button>
          </div>
          {session.joinRequests.length > 0 ? (
            <div className="group-study-host-controls__requests">
              <h4>Pending join requests</h4>
              <ul>
                {session.joinRequests.map((req) => (
                  <li key={req.id}>
                    <div className="group-study-person__identity">
                      <span aria-hidden="true">{initials(req.name)}</span>
                      <div>
                        <strong>{req.name}</strong>
                        <p>{formatHistoryDate(req.createdAt, timezone)}</p>
                      </div>
                    </div>
                    <div className="group-study-host-controls__request-actions">
                      <Button
                        disabled={isPending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await respondToJoinRequestAction({
                              action: "approve",
                              requestId: req.id,
                              roomId: session.id,
                            })
                            if (!result.ok) toast.error(result.error.message)
                            else router.refresh()
                          })
                        }}
                        size="sm"
                      >
                        <Check aria-hidden="true" /> Approve
                      </Button>
                      <Button
                        disabled={isPending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await respondToJoinRequestAction({
                              action: "reject",
                              requestId: req.id,
                              roomId: session.id,
                            })
                            if (!result.ok) toast.error(result.error.message)
                            else router.refresh()
                          })
                        }}
                        size="sm"
                        variant="destructive"
                      >
                        <Ban aria-hidden="true" /> Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="group-study-room__section-title">
        <div>
          <Users aria-hidden="true" />
          <h4>Studying now</h4>
        </div>
        <span>
          {session.participants.length} / {session.participantLimit} active
        </span>
      </div>
      <div className="group-study-room__participants">
        {session.participants.map((participant) => (
          <article
            className="group-study-person"
            data-current={participant.isCurrentUser}
            data-state={participant.status}
            key={participant.id}
          >
            <div className="group-study-person__identity">
              <span aria-hidden="true">{initials(participant.name)}</span>
              <div>
                <h4>
                  {participant.name}
                  {participant.isCurrentUser ? <small>You</small> : null}
                  {participant.isHost ? <small>Host</small> : null}
                </h4>
                <p>{participant.subject}</p>
              </div>
            </div>
            <strong className="group-study-person__clock">
              {formatParticipantClock(participant, nowMs)}
            </strong>
            <span className="group-study-person__status">
              {participant.status === "running" ? (
                <Play aria-hidden="true" />
              ) : (
                <Pause aria-hidden="true" />
              )}
              {participant.status === "running" ? "Focusing" : "Paused"}
            </span>
            {session.isHost && !participant.isCurrentUser ? (
              <div className="group-study-person__moderation">
                <button
                  aria-label={`Remove ${participant.name} from room`}
                  disabled={isPending}
                  onClick={() => moderate(participant, "removed")}
                  type="button"
                >
                  <UserMinus aria-hidden="true" /> Remove
                </button>
                <button
                  aria-label={`Block ${participant.name} from room`}
                  disabled={isPending}
                  onClick={() => moderate(participant, "blocked")}
                  type="button"
                >
                  <Ban aria-hidden="true" /> Block
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="group-study-room__section-title group-study-room__section-title--activity">
        <div>
          <Clock3 aria-hidden="true" />
          <h4>Room activity</h4>
        </div>
        <span>Live timestamps</span>
      </div>
      <ol className="group-study-room__activity">
        {session.activities.map((activity) => (
          <li data-action={activity.action} key={activity.id}>
            <span aria-hidden="true" />
            <p>
              <strong>{activity.name}</strong> {activityCopy(activity)}
            </p>
            <time dateTime={activity.occurredAt}>
              {formatActivityTime(activity.occurredAt, timezone)}
            </time>
          </li>
        ))}
      </ol>
    </div>
  )
}
