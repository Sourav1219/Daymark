"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArchiveRestore,
  CalendarClock,
  Clock3,
  History,
  Sparkles,
} from "lucide-react"
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
  rescheduleMissedQuestAction,
  type QuestTransitionInput,
} from "@/features/quests/application/actions"
import type { RestoredTaskNotice } from "@/features/quests/components/task-restored-popup"
import { QuestDatePicker } from "@/features/quests/components/quest-date-picker"
import { QuestTimePicker } from "@/features/quests/components/quest-time-picker"
import {
  addDaysToLocalDate,
  addMinutesToLocalTime,
  formatZonedLocalInput,
  parseZonedLocalDateTime,
  timezoneAbbreviation,
} from "@/features/reminders/domain/timezone"
import { cn } from "@/lib/utils"

const restoreToastDurationMs = 4_000

function initialTimeline(
  referenceNow: string,
  timezone: string,
  sameDayOnly: boolean,
) {
  const reference = new Date(referenceNow)
  const referenceLocal = formatZonedLocalInput(reference, timezone)
  const fixedDate = timelineParts(referenceLocal).date
  const minimum = formatZonedLocalInput(
    new Date((Math.floor(reference.getTime() / 60_000) + 1) * 60_000),
    timezone,
  )
  const dayEnd = `${fixedDate}T23:59`
  const maxSameDayStart = `${fixedDate}T23:58`

  if (sameDayOnly && minimum > maxSameDayStart) {
    return { dueAt: "", startAt: "" }
  }

  const start = new Date(
    Math.ceil((reference.getTime() + 1) / 900_000) * 900_000,
  )
  const roundedStart = formatZonedLocalInput(start, timezone)
  const startAt =
    sameDayOnly && roundedStart > maxSameDayStart
      ? minimum > maxSameDayStart
        ? maxSameDayStart
        : minimum
      : roundedStart
  const suggestedDue = formatZonedLocalInput(
    new Date(
      (parseZonedLocalDateTime(startAt, timezone) ?? start).getTime() +
        60 * 60_000,
    ),
    timezone,
  )

  return {
    dueAt: sameDayOnly && suggestedDue > dayEnd ? dayEnd : suggestedDue,
    startAt,
  }
}

function timelineParts(value: string) {
  const [date = "", time = ""] = value.split("T")
  return { date, time }
}

export function RestoreQuestScheduleDialog({
  input,
  mode = "restore",
  onRestored,
  referenceNow: referenceNowProp,
  timezone,
  title,
  triggerClassName,
}: Readonly<{
  input: QuestTransitionInput
  mode?: "restore" | "reschedule"
  onRestored: (task: RestoredTaskNotice) => void
  referenceNow?: string | undefined
  timezone: string
  title: string
  triggerClassName?: string | undefined
}>) {
  const router = useRouter()
  const sameDayOnly = mode === "restore"
  const isTest = process.env.NODE_ENV === "test"
  const [open, setOpen] = useState(false)
  const [nowMs, setNowMs] = useState(() =>
    isTest && referenceNowProp
      ? new Date(referenceNowProp).getTime()
      : Date.now(),
  )

  useEffect(() => {
    if (!open) return
    if (isTest && referenceNowProp) return

    const timer = setInterval(() => setNowMs(Date.now()), 5_000)
    return () => clearInterval(timer)
  }, [open, isTest, referenceNowProp])

  const effectiveReferenceNow =
    isTest && referenceNowProp
      ? referenceNowProp
      : new Date(nowMs).toISOString()
  const [timeline, setTimeline] = useState(() =>
    initialTimeline(effectiveReferenceNow, timezone, sameDayOnly),
  )
  const [pickerPortal, setPickerPortal] = useState<HTMLElement | null>(null)
  const [isPending, startTransition] = useTransition()
  const mobileViewport =
    typeof document !== "undefined"
      ? document.getElementById("app-device-viewport")
      : null
  const zoneLabel = timezoneAbbreviation(timezone)
  const referenceTime = nowMs
  const minimum = formatZonedLocalInput(
    new Date((Math.floor(referenceTime / 60_000) + 1) * 60_000),
    timezone,
  )
  const fixedDate = timelineParts(
    formatZonedLocalInput(new Date(referenceTime), timezone),
  ).date
  const dayEnd = `${fixedDate}T23:59`
  const maxSameDayStart = `${fixedDate}T23:58`
  const scheduleClosed = sameDayOnly && minimum > maxSameDayStart
  const outsideRestoreDay =
    sameDayOnly &&
    (timelineParts(timeline.startAt).date !== fixedDate ||
      timelineParts(timeline.dueAt).date !== fixedDate)
  const invalidOrder = Boolean(
    timeline.startAt && timeline.dueAt && timeline.dueAt <= timeline.startAt,
  )
  const elapsed = timeline.startAt < minimum || timeline.dueAt < minimum
  const invalid =
    !timeline.startAt ||
    !timeline.dueAt ||
    invalidOrder ||
    elapsed ||
    outsideRestoreDay ||
    scheduleClosed
  const minimumParts = timelineParts(minimum)
  const startParts = timelineParts(timeline.startAt)
  const dueParts = timelineParts(timeline.dueAt)

  const nextMinuteAfterStart = startParts.time
    ? addMinutesToLocalTime(startParts.time, 1)
    : undefined

  const dueMinDate =
    startParts.time === "23:59" && startParts.date
      ? addDaysToLocalDate(startParts.date, 1)
      : startParts.date || minimumParts.date

  const dueMinTime =
    dueParts.date === startParts.date && nextMinuteAfterStart
      ? dueParts.date === minimumParts.date &&
        minimumParts.time > nextMinuteAfterStart
        ? minimumParts.time
        : nextMinuteAfterStart
      : dueParts.date === minimumParts.date
        ? minimumParts.time
        : undefined

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

      if (
        key === "startAt" &&
        nextValue &&
        current.dueAt &&
        current.dueAt <= nextValue
      ) {
        const shiftedDue = parseZonedLocalDateTime(nextValue, timezone)
        if (shiftedDue) {
          const suggestedDue = formatZonedLocalInput(
            new Date(shiftedDue.getTime() + 60 * 60_000),
            timezone,
          )
          next.dueAt =
            sameDayOnly && suggestedDue > dayEnd ? dayEnd : suggestedDue
        }
      }

      if (
        key === "dueAt" &&
        nextValue &&
        current.startAt &&
        nextValue <= current.startAt
      ) {
        const shiftedDue = parseZonedLocalDateTime(current.startAt, timezone)
        if (shiftedDue) {
          const suggestedDue = formatZonedLocalInput(
            new Date(shiftedDue.getTime() + 60 * 60_000),
            timezone,
          )
          next.dueAt =
            sameDayOnly && suggestedDue > dayEnd ? dayEnd : suggestedDue
        }
      }

      return next
    })
  }

  function restoreWithTimeline() {
    if (invalid || isPending) return

    startTransition(async () => {
      let restoringToast: number | string | undefined

      function showRestoreError(message: string) {
        if (restoringToast === undefined) {
          toast.error(message)
          return
        }
        toast.error(message, {
          duration: restoreToastDurationMs,
          id: restoringToast,
        })
      }

      try {
        const restoreRequest = (
          mode === "reschedule"
            ? rescheduleMissedQuestAction
            : restoreQuestWithScheduleAction
        )({
          ...input,
          ...timeline,
        })

        if (mode === "restore") {
          restoringToast = toast.loading("Restoring task…")
          setOpen(false)
          router.replace("/today")
        }

        const result = await restoreRequest

        if (!result.ok) {
          showRestoreError(result.error.message)
          return
        }

        if (mode === "restore") {
          if (restoringToast !== undefined) {
            toast.success("Task restored", {
              duration: restoreToastDurationMs,
              id: restoringToast,
            })
          }
          router.refresh()
          return
        }

        setOpen(false)
        onRestored({ id: result.data.id, title })
        router.refresh()
      } catch {
        showRestoreError(
          "The task could not be restored. It is still in Trash.",
        )
      }
    })
  }

  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          if (sameDayOnly) router.prefetch("/today")
          const freshNow =
            isTest && referenceNowProp
              ? new Date(referenceNowProp).getTime()
              : Date.now()
          setNowMs(freshNow)
          setTimeline(
            initialTimeline(
              isTest && referenceNowProp
                ? referenceNowProp
                : new Date(freshNow).toISOString(),
              timezone,
              sameDayOnly,
            ),
          )
        }
        setOpen(nextOpen)
      }}
      open={open}
    >
      <AlertDialogTrigger asChild>
        <Button
          className={cn(
            "restore-schedule-dialog__trigger",
            mode === "reschedule"
              ? "restore-schedule-dialog__trigger--reschedule"
              : "restore-schedule-dialog__trigger--restore",
            triggerClassName,
          )}
          variant="outline"
        >
          <ArchiveRestore aria-hidden="true" />
          {mode === "reschedule" ? "Reschedule" : "Restore Task"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        className="restore-schedule-dialog"
        disableDefaultOverlayBlur
        overlayClassName="restore-schedule-dialog__overlay"
        placement="viewport"
        portalContainer={mobileViewport}
        ref={setPickerPortal}
      >
        <span aria-hidden="true" className="restore-schedule-dialog__orb" />
        <AlertDialogHeader className="restore-schedule-dialog__header">
          <AlertDialogMedia className="restore-schedule-dialog__media">
            <CalendarClock aria-hidden="true" />
            <Sparkles aria-hidden="true" />
          </AlertDialogMedia>
          <div className="restore-schedule-dialog__heading-copy">
            <div className="restore-schedule-dialog__eyebrow">
              <span>{sameDayOnly ? "Missed today" : "Recovery plan"}</span>
              <span>{zoneLabel}</span>
            </div>
            <AlertDialogTitle>
              {sameDayOnly ? "Restore for today" : "Set a new timeline"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sameDayOnly
                ? "Clear today's missed marker by setting a realistic start and finish before midnight."
                : "Choose a fresh future window before returning this task to Home."}
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
                <div className="restore-schedule-dialog__field-title">
                  <span aria-hidden="true">01</span>
                  <strong>New start time</strong>
                </div>
                <span>
                  {sameDayOnly
                    ? "Today · earliest available"
                    : "When work begins"}
                </span>
              </div>
              <div className="restore-schedule-dialog__controls">
                <div>
                  <Label htmlFor={`restore-${input.questId}-start-date`}>
                    {sameDayOnly ? "Date · fixed" : "Date"}
                  </Label>
                  <QuestDatePicker
                    ariaLabel={`Start date · ${zoneLabel}`}
                    disabled={sameDayOnly}
                    id={`restore-${input.questId}-start-date`}
                    minDate={minimumParts.date}
                    onChange={(value) =>
                      updateTimeline("startAt", "date", value)
                    }
                    portalContainer={pickerPortal}
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
                    maxTime={sameDayOnly ? "23:58" : undefined}
                    minTime={
                      startParts.date === minimumParts.date
                        ? minimumParts.time
                        : undefined
                    }
                    onChange={(value) =>
                      updateTimeline("startAt", "time", value)
                    }
                    portalContainer={pickerPortal}
                    showShortcuts={!sameDayOnly}
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
                <div className="restore-schedule-dialog__field-title">
                  <span aria-hidden="true">02</span>
                  <strong>New due time</strong>
                </div>
                <span>
                  {sameDayOnly
                    ? "Today · before midnight"
                    : "When it should be finished"}
                </span>
              </div>
              <div className="restore-schedule-dialog__controls">
                <div>
                  <Label htmlFor={`restore-${input.questId}-due-date`}>
                    {sameDayOnly ? "Date · fixed" : "Date"}
                  </Label>
                  <QuestDatePicker
                    ariaLabel={`Due date · ${zoneLabel}`}
                    disabled={sameDayOnly}
                    id={`restore-${input.questId}-due-date`}
                    minDate={dueMinDate}
                    onChange={(value) => updateTimeline("dueAt", "date", value)}
                    portalContainer={pickerPortal}
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
                    maxTime={sameDayOnly ? "23:59" : undefined}
                    minTime={dueMinTime}
                    minTimeMessage={
                      dueParts.date === startParts.date && nextMinuteAfterStart
                        ? "Due time must be after start time."
                        : undefined
                    }
                    onChange={(value) => updateTimeline("dueAt", "time", value)}
                    portalContainer={pickerPortal}
                    showShortcuts={!sameDayOnly}
                    value={dueParts.time}
                  />
                </div>
              </div>
            </div>
          </div>

          <p
            aria-live="polite"
            className="restore-schedule-dialog__note"
            data-error={
              invalidOrder || elapsed || outsideRestoreDay || scheduleClosed
            }
          >
            <History aria-hidden="true" />
            <span>
              {scheduleClosed
                ? "Today's restoration scheduling window has ended."
                : outsideRestoreDay
                  ? "The restored task must start and finish today."
                  : invalidOrder
                    ? "Due time must be after start time."
                    : elapsed
                      ? "Both times must be in the future."
                      : sameDayOnly
                        ? `Times are limited to today before midnight in ${zoneLabel}.`
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
            {isPending
              ? "Saving…"
              : mode === "reschedule"
                ? "Reschedule task"
                : "Restore to Home"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
