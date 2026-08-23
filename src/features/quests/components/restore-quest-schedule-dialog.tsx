"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArchiveRestore,
  CalendarClock,
  Clock3,
  History,
  Sparkles,
} from "lucide-react"
import { DateTime } from "luxon"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  restoreQuestWithScheduleAction,
  type QuestTransitionInput,
} from "@/features/quests/application/actions"
import type { RestoredTaskNotice } from "@/features/quests/components/task-restored-popup"
import { QuestDatePicker } from "@/features/quests/components/quest-date-picker"
import { QuestTimePicker } from "@/features/quests/components/quest-time-picker"
import { timezoneAbbreviation } from "@/features/reminders/domain/timezone"

function initialTimeline(referenceNow: string, timezone: string) {
  const now = DateTime.fromISO(referenceNow, { setZone: true }).setZone(
    timezone,
  )
  const start = now.plus({ minutes: 15 - (now.minute % 15) }).startOf("minute")

  return {
    dueAt: start.plus({ hours: 1 }).toFormat("yyyy-MM-dd'T'HH:mm"),
    startAt: start.toFormat("yyyy-MM-dd'T'HH:mm"),
  }
}

function timelineParts(value: string) {
  const [date = "", time = ""] = value.split("T")
  return { date, time }
}

export function RestoreQuestScheduleDialog({
  input,
  onRestored,
  referenceNow,
  timezone,
  title,
}: Readonly<{
  input: QuestTransitionInput
  onRestored: (task: RestoredTaskNotice) => void
  referenceNow: string
  timezone: string
  title: string
}>) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [timeline, setTimeline] = useState(() =>
    initialTimeline(referenceNow, timezone),
  )
  const [isPending, startTransition] = useTransition()
  const zoneLabel = timezoneAbbreviation(timezone)
  const minimum = DateTime.fromISO(referenceNow, { setZone: true })
    .setZone(timezone)
    .plus({ minutes: 1 })
    .startOf("minute")
    .toFormat("yyyy-MM-dd'T'HH:mm")
  const invalidOrder = timeline.dueAt < timeline.startAt
  const elapsed = timeline.startAt < minimum || timeline.dueAt < minimum
  const invalid =
    !timeline.startAt || !timeline.dueAt || invalidOrder || elapsed
  const minimumParts = timelineParts(minimum)
  const startParts = timelineParts(timeline.startAt)
  const dueParts = timelineParts(timeline.dueAt)

  function updateTimeline(
    key: "dueAt" | "startAt",
    part: "date" | "time",
    value: string,
  ) {
    setTimeline((current) => {
      const currentParts = timelineParts(current[key])
      const date = part === "date" ? value : currentParts.date
      const time = part === "time" ? value : currentParts.time
      const nextValue = date && time ? `${date}T${time}` : ""
      const next = { ...current, [key]: nextValue }

      if (key === "startAt" && nextValue && current.dueAt < nextValue) {
        const shiftedDue = DateTime.fromFormat(
          nextValue,
          "yyyy-MM-dd'T'HH:mm",
          { zone: timezone },
        ).plus({ hours: 1 })
        next.dueAt = shiftedDue.toFormat("yyyy-MM-dd'T'HH:mm")
      }

      return next
    })
  }

  function restoreWithTimeline() {
    if (invalid || isPending) return

    startTransition(async () => {
      try {
        const result = await restoreQuestWithScheduleAction({
          ...input,
          ...timeline,
        })

        if (!result.ok) {
          toast.error(result.error.message)
          return
        }

        setOpen(false)
        onRestored({ id: result.data.id, title })
        router.refresh()
      } catch {
        toast.error("The task could not be restored. Refresh and retry.")
      }
    })
  }

  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        if (nextOpen) setTimeline(initialTimeline(referenceNow, timezone))
        setOpen(nextOpen)
      }}
      open={open}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline">
          <ArchiveRestore aria-hidden="true" />
          Restore Task
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="restore-schedule-dialog">
        <span aria-hidden="true" className="restore-schedule-dialog__orb" />
        <AlertDialogHeader className="restore-schedule-dialog__header">
          <AlertDialogMedia className="restore-schedule-dialog__media">
            <CalendarClock aria-hidden="true" />
            <Sparkles aria-hidden="true" />
          </AlertDialogMedia>
          <div className="restore-schedule-dialog__heading-copy">
            <div className="restore-schedule-dialog__eyebrow">
              <span>Recovery plan</span>
              <span>{zoneLabel}</span>
            </div>
            <AlertDialogTitle>Set a new timeline</AlertDialogTitle>
            <AlertDialogDescription>
              Choose a fresh future window before returning this task to Home.
            </AlertDialogDescription>
          </div>
          <strong className="restore-schedule-dialog__task">{title}</strong>
        </AlertDialogHeader>

        <div className="restore-schedule-dialog__fields">
          <div className="restore-schedule-dialog__moment" data-kind="start">
            <span
              aria-hidden="true"
              className="restore-schedule-dialog__marker"
            >
              <Clock3 />
            </span>
            <div className="restore-schedule-dialog__field">
              <div className="restore-schedule-dialog__field-heading">
                <strong>New start</strong>
                <span>When you will begin</span>
              </div>
              <div className="restore-schedule-dialog__controls">
                <div>
                  <Label htmlFor={`restore-${input.questId}-start-date`}>
                    Date
                  </Label>
                  <QuestDatePicker
                    ariaLabel={`Start date · ${zoneLabel}`}
                    id={`restore-${input.questId}-start-date`}
                    minDate={minimumParts.date}
                    onChange={(value) =>
                      updateTimeline("startAt", "date", value)
                    }
                    value={startParts.date}
                  />
                </div>
                <div>
                  <Label htmlFor={`restore-${input.questId}-start-time`}>
                    Time
                  </Label>
                  <QuestTimePicker
                    ariaLabel={`Start time · ${zoneLabel}`}
                    disabled={!startParts.date}
                    id={`restore-${input.questId}-start-time`}
                    minTime={
                      startParts.date === minimumParts.date
                        ? minimumParts.time
                        : undefined
                    }
                    onChange={(value) =>
                      updateTimeline("startAt", "time", value)
                    }
                    value={startParts.time}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="restore-schedule-dialog__connector" />

          <div className="restore-schedule-dialog__moment" data-kind="due">
            <span
              aria-hidden="true"
              className="restore-schedule-dialog__marker"
            >
              <ArchiveRestore />
            </span>
            <div className="restore-schedule-dialog__field">
              <div className="restore-schedule-dialog__field-heading">
                <strong>New due time</strong>
                <span>When it should be finished</span>
              </div>
              <div className="restore-schedule-dialog__controls">
                <div>
                  <Label htmlFor={`restore-${input.questId}-due-date`}>
                    Date
                  </Label>
                  <QuestDatePicker
                    ariaLabel={`Due date · ${zoneLabel}`}
                    id={`restore-${input.questId}-due-date`}
                    minDate={startParts.date || minimumParts.date}
                    onChange={(value) => updateTimeline("dueAt", "date", value)}
                    value={dueParts.date}
                  />
                </div>
                <div>
                  <Label htmlFor={`restore-${input.questId}-due-time`}>
                    Time
                  </Label>
                  <QuestTimePicker
                    ariaLabel={`Due time · ${zoneLabel}`}
                    disabled={!dueParts.date}
                    id={`restore-${input.questId}-due-time`}
                    minTime={
                      dueParts.date === startParts.date
                        ? startParts.time
                        : dueParts.date === minimumParts.date
                          ? minimumParts.time
                          : undefined
                    }
                    onChange={(value) => updateTimeline("dueAt", "time", value)}
                    value={dueParts.time}
                  />
                </div>
              </div>
            </div>
          </div>

          <p
            aria-live="polite"
            className="restore-schedule-dialog__note"
            data-error={invalidOrder || elapsed}
          >
            <History aria-hidden="true" />
            <span>
              {invalidOrder
                ? "Due time must be after the new start."
                : elapsed
                  ? "Both times must be in the future."
                  : `Scheduled in ${zoneLabel}. The previous missed record stays safely in Progress.`}
            </span>
          </p>
        </div>

        <AlertDialogFooter className="restore-schedule-dialog__footer">
          <AlertDialogCancel
            className="restore-schedule-dialog__cancel"
            disabled={isPending}
          >
            Cancel
          </AlertDialogCancel>
          <Button
            className="restore-schedule-dialog__submit"
            disabled={invalid || isPending}
            onClick={restoreWithTimeline}
          >
            <ArchiveRestore aria-hidden="true" />
            {isPending ? "Restoring" : "Restore with new time"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
