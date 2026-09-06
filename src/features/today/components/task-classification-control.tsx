"use client"

import { useEffect, useId, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  Check,
  Pencil,
} from "lucide-react"
import { toast } from "sonner"
import {
  taskTypes,
  typeLabels,
  formatTaskTypeLabel,
  resolveClassification,
  type TaskClassification,
  type TaskType,
} from "@/features/quests/domain/classification"
import {
  questPriorities,
  type QuestPriority,
} from "@/features/quests/domain/types"
import type { ClassifyQuestCommand } from "@/features/quests/validation/classification-validation"
import { classifyQuestAction } from "@/features/quests/application/actions"
import { editQuestScheduleAction } from "@/features/quests/application/actions"
import { useOptionalOffline } from "@/features/offline/components/offline-provider"
import { QuestDatePicker } from "@/features/quests/components/quest-date-picker"
import { QuestTimePicker } from "@/features/quests/components/quest-time-picker"
import {
  formatZonedLocalInput,
  parseZonedLocalDateTime,
} from "@/features/reminders/domain/timezone"
import type { TodayCard } from "@/features/today/types"

const priorityLabels: Record<QuestPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
}

export function TaskClassificationControl({
  card,
  onClassified,
  timezone = "UTC",
}: Readonly<{
  card: TodayCard
  onClassified?:
    | ((
        id: string,
        value: TaskClassification,
        version: number,
        priority?: QuestPriority,
      ) => void)
    | undefined
  timezone?: string
}>) {
  const router = useRouter()
  const offline = useOptionalOffline()
  const pickerId = useId()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(() => resolveClassification(card))
  const [selectedType, setSelectedType] = useState<TaskType>(value.taskType)
  const [customInput, setCustomInput] = useState(value.customType ?? "")
  const [selectedPriority, setSelectedPriority] = useState<QuestPriority>(
    card.priority,
  )
  const [version, setVersion] = useState(card.version)
  const [source, setSource] = useState(card)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pickerPortal, setPickerPortal] = useState<HTMLDivElement | null>(null)

  if (source !== card) {
    setSource(card)
    const resolved = resolveClassification(card)
    setValue(resolved)
    setSelectedType(resolved.taskType)
    setCustomInput(resolved.customType ?? "")
    setSelectedPriority(card.priority)
    setVersion(card.version)
  }

  const [pending, startTransition] = useTransition()

  // Schedule editing state
  const scheduleInitial = {
    startAt: card.startAt
      ? formatZonedLocalInput(new Date(card.startAt), timezone)
      : "",
    dueAt: card.dueAt
      ? formatZonedLocalInput(new Date(card.dueAt), timezone)
      : "",
  }
  const [scheduleDraft, setScheduleDraft] = useState(scheduleInitial)
  const [scheduleError, setScheduleError] = useState("")
  const [schedulePending, startScheduleTransition] = useTransition()
  const scheduleChanged =
    scheduleDraft.startAt !== scheduleInitial.startAt ||
    scheduleDraft.dueAt !== scheduleInitial.dueAt
  const scheduleIncomplete = Object.values(scheduleDraft).some(
    (v) => v && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v),
  )

  const [startDate = "", startTime = ""] = (scheduleDraft.startAt || "").split("T")
  const [dueDate = "", dueTime = ""] = (scheduleDraft.dueAt || "").split("T")

  const [referenceNow, setReferenceNow] = useState(() => Date.now())
  const earliestSchedule = new Date(
    (Math.floor(referenceNow / 60_000) + 1) * 60_000,
  )
  const earliestLocalInput = formatZonedLocalInput(earliestSchedule, timezone)
  const earliestDate = earliestLocalInput.slice(0, 10)
  const earliestTime = earliestLocalInput.slice(11, 16)

  const parsedStart = scheduleDraft.startAt
    ? parseZonedLocalDateTime(scheduleDraft.startAt, timezone)
    : null
  const parsedDue = scheduleDraft.dueAt
    ? parseZonedLocalDateTime(scheduleDraft.dueAt, timezone)
    : null

  const startElapsed = Boolean(
    parsedStart &&
      parsedStart.getTime() < earliestSchedule.getTime() &&
      scheduleDraft.startAt !== scheduleInitial.startAt,
  )
  const dueElapsed = Boolean(
    parsedDue &&
      parsedDue.getTime() < earliestSchedule.getTime() &&
      scheduleDraft.dueAt !== scheduleInitial.dueAt,
  )

  const scheduleValidation = scheduleIncomplete
    ? "Choose both a date and time, or clear the field."
    : (scheduleDraft.startAt && !parsedStart) ||
        (scheduleDraft.dueAt && !parsedDue)
      ? "That local time does not exist. Choose another time."
      : startElapsed
        ? "That start time has already passed. Pick a later time."
        : dueElapsed
          ? "That due time has already passed. Pick a later time."
          : parsedStart && parsedDue && parsedDue < parsedStart
            ? "Due time cannot be earlier than start time."
            : card.recurrenceRule && !parsedStart && !parsedDue
              ? "Recurring tasks need a start or due time."
              : ""
  const scheduleUnavailable = Boolean(offline?.isOffline)

  function updateSchedule(
    key: "startAt" | "dueAt",
    part: "date" | "time",
    val: string,
  ) {
    setScheduleDraft((current) => {
      const parts = (current[key] || "").split("T")
      const curDate = parts[0] || ""
      const curTime = parts[1] || ""

      if (part === "date" && !val) {
        return { ...current, [key]: "" }
      }

      const nextDate = part === "date" ? val : curDate
      const fallbackTime = key === "startAt" ? "09:00" : "17:00"
      const requestedTime =
        part === "time" ? val || fallbackTime : curTime || fallbackTime

      // If the chosen date is today, pull earlier times forward
      const effectiveTime =
        nextDate === earliestDate && requestedTime < earliestTime
          ? earliestTime
          : requestedTime

      const nextValue = nextDate ? `${nextDate}T${effectiveTime}` : ""
      const next = { ...current, [key]: nextValue }

      // If startAt moves past dueAt, push dueAt forward
      if (
        key === "startAt" &&
        nextValue &&
        current.dueAt &&
        current.dueAt <= nextValue
      ) {
        const shiftedDue = parseZonedLocalDateTime(nextValue, timezone)
        if (shiftedDue) {
          next.dueAt = formatZonedLocalInput(
            new Date(shiftedDue.getTime() + 60 * 60_000),
            timezone,
          )
        }
      }

      return next
    })
    setScheduleError("")
  }


  // Auto-close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  function save(change: {
    taskType?: TaskType
    customType?: string | null
    priority?: QuestPriority
  }) {
    const nextClassification: TaskClassification = {
      taskType: change.taskType ?? value.taskType,
      customType:
        change.customType !== undefined ? change.customType : value.customType,
      typeManual: change.taskType !== undefined ? true : value.typeManual,
    }
    startTransition(async () => {
      try {
        const input: ClassifyQuestCommand = {
          expectedVersion: version,
          questId: card.id,
          ...(change.taskType ? { taskType: change.taskType } : {}),
          ...(change.customType !== undefined
            ? { customType: change.customType }
            : {}),
          ...(change.priority ? { priority: change.priority } : {}),
        }
        if (offline?.isOffline) {
          await offline.queueClassification({ ...input, title: card.title })
          setValue(nextClassification)
          if (change.priority) setSelectedPriority(change.priority)
          onClassified?.(card.id, nextClassification, version, change.priority)
          toast.success(
            "Classification saved offline. It will sync when connected.",
          )
        } else {
          const result = await classifyQuestAction(input)
          if (!result.ok) {
            toast.error(result.error.message)
            return
          }
          setValue(nextClassification)
          if (change.priority) setSelectedPriority(change.priority)
          setVersion(result.data.version)
          onClassified?.(
            card.id,
            nextClassification,
            result.data.version,
            change.priority,
          )
        }
      } catch {
        toast.error("Could not save classification. Please retry.")
      }
    })
  }

  function saveSchedule() {
    if (
      !scheduleChanged ||
      scheduleValidation ||
      schedulePending ||
      scheduleUnavailable
    )
      return
    setScheduleError("")
    startScheduleTransition(async () => {
      try {
        const result = await editQuestScheduleAction({
          questId: card.id,
          expectedVersion: version,
          ...(scheduleDraft.startAt !== scheduleInitial.startAt
            ? { startAt: scheduleDraft.startAt || null }
            : {}),
          ...(scheduleDraft.dueAt !== scheduleInitial.dueAt
            ? { dueAt: scheduleDraft.dueAt || null }
            : {}),
        })
        if (!result.ok) {
          setScheduleError(result.error.message)
          return
        }
        setVersion(result.data.version)
        setOpen(false)
        toast.success("Schedule updated")
        router.refresh()
      } catch {
        setScheduleError("Could not save the schedule. Please try again.")
      }
    })
  }

  const anyPending = pending || schedulePending

  return (
    <div className="task-classification" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-label={`Edit ${card.title}: ${formatTaskTypeLabel(value)}`}
        className="task-classification__trigger"
        data-type={value.taskType}
        onClick={() => {
          setSelectedType(value.taskType)
          setCustomInput(value.customType ?? "")
          setSelectedPriority(card.priority)
          if (!open) {
            // Reset schedule draft and update referenceNow when opening
            setReferenceNow(Date.now())
            setScheduleDraft(scheduleInitial)
            setScheduleError("")
          }
          setOpen(!open)
        }}
        type="button"
      >
        <span>{formatTaskTypeLabel(value)}</span>
        <Pencil aria-hidden="true" />
      </button>

      {open ? (
        <div
          aria-label={`Edit ${card.title}`}
          className="home-choice-panel task-classification__panel"
          ref={setPickerPortal}
        >
          <div className="home-choice-panel__heading">
            <span>Task type</span>
          </div>
          <fieldset disabled={anyPending}>
            <div className="home-choice-grid">
              {taskTypes.map((type) => (
                <button
                  aria-pressed={selectedType === type}
                  data-type={type}
                  key={type}
                  onClick={() => {
                    if (type === "custom") {
                      setSelectedType("custom")
                    } else {
                      setSelectedType(type)
                      save({ taskType: type, customType: null })
                    }
                  }}
                  type="button"
                >
                  {typeLabels[type]}
                </button>
              ))}
            </div>
          </fieldset>
          {selectedType === "custom" ? (
            <form
              className="task-classification__custom-form"
              onSubmit={(e) => {
                e.preventDefault()
                save({
                  taskType: "custom",
                  customType: customInput.trim() || null,
                })
              }}
            >
              <input
                autoFocus
                className="task-classification__custom-input"
                maxLength={64}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Enter custom type..."
                type="text"
                value={customInput}
              />
              <button
                className="task-classification__custom-save"
                type="submit"
              >
                Save
              </button>
            </form>
          ) : null}

          <div
            className="home-choice-panel__heading"
            style={{ marginTop: "0.55rem" }}
          >
            <span>Priority</span>
          </div>
          <fieldset disabled={anyPending}>
            <div className="home-choice-grid task-priority-grid">
              {questPriorities.map((p) => (
                <button
                  aria-pressed={selectedPriority === p}
                  data-priority={p}
                  key={p}
                  onClick={() => {
                    setSelectedPriority(p)
                    save({ priority: p })
                  }}
                  type="button"
                >
                  {priorityLabels[p]}
                </button>
              ))}
            </div>
          </fieldset>

          {/* ── Schedule section ────────────────────────────── */}
          <div
            className="home-choice-panel__heading"
            style={{ marginTop: "0.55rem" }}
          >
            <span>Schedule</span>
          </div>
          <div className="task-edit-schedule">
            {/* Start moment */}
            <fieldset
              className="task-edit-schedule__field"
              disabled={anyPending || scheduleUnavailable}
            >
              <legend>Start</legend>
              <div className="task-edit-schedule__pickers">
                <QuestDatePicker
                  ariaLabel="Start date"
                  disabled={anyPending || scheduleUnavailable}
                  id={`${pickerId}-startAt-date`}
                  minDate={earliestDate}
                  onChange={(v) => updateSchedule("startAt", "date", v)}
                  portalContainer={pickerPortal}
                  value={startDate}
                />
                <QuestTimePicker
                  ariaLabel="Start time"
                  disabled={!startDate || anyPending || scheduleUnavailable}
                  id={`${pickerId}-startAt-time`}
                  minTime={
                    startDate === earliestDate ? earliestTime : undefined
                  }
                  onChange={(v) => updateSchedule("startAt", "time", v)}
                  portalContainer={pickerPortal}
                  value={startTime}
                />
              </div>
              <button
                className="task-edit-schedule__clear"
                disabled={
                  !scheduleDraft.startAt ||
                  anyPending ||
                  scheduleUnavailable
                }
                onClick={() => {
                  setScheduleDraft((cur) => ({ ...cur, startAt: "" }))
                  setScheduleError("")
                }}
                type="button"
              >
                Clear start
              </button>
            </fieldset>

            {/* Due moment */}
            {(() => {
              const dueMinTime =
                dueDate === startDate && startTime
                  ? dueDate === earliestDate && earliestTime > startTime
                    ? earliestTime
                    : startTime
                  : dueDate === earliestDate
                    ? earliestTime
                    : undefined

              return (
                <fieldset
                  className="task-edit-schedule__field"
                  disabled={anyPending || scheduleUnavailable}
                >
                  <legend>Due</legend>
                  <div className="task-edit-schedule__pickers">
                    <QuestDatePicker
                      ariaLabel="Due date"
                      disabled={anyPending || scheduleUnavailable}
                      id={`${pickerId}-dueAt-date`}
                      minDate={startDate || earliestDate}
                      onChange={(v) => updateSchedule("dueAt", "date", v)}
                      portalContainer={pickerPortal}
                      value={dueDate}
                    />
                    <QuestTimePicker
                      ariaLabel="Due time"
                      disabled={!dueDate || anyPending || scheduleUnavailable}
                      id={`${pickerId}-dueAt-time`}
                      minTime={dueMinTime}
                      onChange={(v) => updateSchedule("dueAt", "time", v)}
                      portalContainer={pickerPortal}
                      value={dueTime}
                    />
                  </div>
                  <button
                    className="task-edit-schedule__clear"
                    disabled={
                      !scheduleDraft.dueAt ||
                      anyPending ||
                      scheduleUnavailable
                    }
                    onClick={() => {
                      setScheduleDraft((cur) => ({ ...cur, dueAt: "" }))
                      setScheduleError("")
                    }}
                    type="button"
                  >
                    Clear due
                  </button>
                </fieldset>
              )
            })()}
            <p className="task-edit-schedule__zone">
              Times shown in {timezone}
            </p>
            {scheduleValidation || scheduleError || scheduleUnavailable ? (
              <p className="task-edit-schedule__error" role="alert">
                {scheduleUnavailable
                  ? "Connect to save schedule changes."
                  : scheduleValidation || scheduleError}
              </p>
            ) : null}
            {scheduleChanged ? (
              <button
                className="task-edit-schedule__save"
                disabled={
                  !scheduleChanged ||
                  Boolean(scheduleValidation) ||
                  anyPending ||
                  scheduleUnavailable
                }
                onClick={saveSchedule}
                type="button"
              >
                <CalendarDays aria-hidden="true" />
                {schedulePending ? "Saving..." : "Save schedule"}
              </button>
            ) : null}
          </div>

          <div className="task-classification__footer">
            <p role="status">
              {anyPending
                ? "Saving…"
                : value.typeManual
                  ? "Your choice is saved."
                  : "Suggested from your task. Change whenever you like."}
            </p>
            <button
              aria-label="Done editing"
              className="task-classification__done"
              disabled={anyPending}
              onClick={() => setOpen(false)}
              type="button"
            >
              <Check aria-hidden="true" />
              <span>Done</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
