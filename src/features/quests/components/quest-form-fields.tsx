"use client"

import { useState } from "react"
import { CalendarDays, Clock3, RotateCcw } from "lucide-react"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { QuestPriority } from "@/features/quests/domain/types"
import { QuestRecurrenceFields } from "@/features/quests/components/quest-recurrence-fields"
import { QuestDatePicker } from "@/features/quests/components/quest-date-picker"
import { QuestTimePicker } from "@/features/quests/components/quest-time-picker"
import {
  defaultTimezone,
  formatZonedLocalInput,
  timezoneAbbreviation,
} from "@/features/reminders/domain/timezone"

export type QuestGateOption = Readonly<{ id: string; name: string }>
export type QuestParentOption = Readonly<{
  id: string
  parentTaskId: string | null
  title: string
}>

type QuestFormFieldsProps = Readonly<{
  defaults?: Readonly<{
    description: string
    dueAt: string | null
    gateName?: string | null
    parentTaskId?: string | null
    priority: QuestPriority
    projectId?: string | null
    recurrenceRule?: string | null
    startAt: string | null
    title: string
  }>
  fieldErrors?: Readonly<Record<string, readonly string[]>> | undefined
  gates?: readonly QuestGateOption[] | undefined
  idPrefix: string
  parentOptions?: readonly QuestParentOption[] | undefined
  /** Quest ID excluded from the parent picker (the Quest being edited). */
  selfQuestId?: string | undefined
  timezone?: string | undefined
  variant?: "create" | "default" | undefined
}>

const priorities: ReadonlyArray<{
  label: string
  value: QuestPriority
}> = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Critical", value: "critical" },
]

type ScheduleKey = "dueAt" | "startAt"

function scheduleParts(
  value: string,
): Readonly<{ date: string; time: string }> {
  const [date = "", time = ""] = value.split("T")
  return { date, time }
}

function FieldError({
  errors,
  id,
}: Readonly<{ errors?: readonly string[] | undefined; id: string }>) {
  const error = errors?.[0]

  return error ? (
    <p className="text-xs leading-5 text-danger" id={id}>
      {error}
    </p>
  ) : null
}

export function QuestFormFields({
  defaults,
  fieldErrors,
  gates,
  idPrefix,
  parentOptions,
  selfQuestId,
  timezone = defaultTimezone,
  variant = "default",
}: QuestFormFieldsProps) {
  const zoneLabel = timezoneAbbreviation(timezone)
  // New tasks cannot be scheduled into a window that has already closed, so
  // earlier days are unselectable and earlier times on today are rejected.
  // Editing keeps full freedom: an existing task may already be overdue.
  const enforceFuture = variant === "create"
  const [referenceNow] = useState(() => Date.now())
  // Time inputs only preserve minute precision. Start at the next whole minute
  // so a value that passes native validation cannot become a past instant when
  // the server restores the omitted seconds as :00.
  const earliestSchedule = new Date(
    (Math.floor(referenceNow / 60_000) + 1) * 60_000,
  )
  const earliestLocalInput = formatZonedLocalInput(earliestSchedule, timezone)
  const earliestDate = enforceFuture
    ? earliestLocalInput.slice(0, 10)
    : undefined
  const earliestTime = earliestLocalInput.slice(11, 16)
  const titleErrorId = `${idPrefix}-title-error`
  const descriptionErrorId = `${idPrefix}-description-error`
  const priorityErrorId = `${idPrefix}-priority-error`
  const startErrorId = `${idPrefix}-start-error`
  const dueErrorId = `${idPrefix}-due-error`
  const selectClass =
    "h-8 w-full rounded-control border border-input bg-surface-inset px-2.5 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
  const eligibleParents =
    parentOptions?.filter((option) => option.id !== selfQuestId) ?? []
  const currentGateMissing =
    defaults?.projectId &&
    !gates?.some((gate) => gate.id === defaults.projectId)
  const currentParentMissing =
    defaults?.parentTaskId &&
    !eligibleParents.some((parent) => parent.id === defaults.parentTaskId)
  const createMode = variant === "create"
  const hasGateOptions = Boolean(gates?.length || currentGateMissing)
  const [schedule, setSchedule] = useState(() => ({
    dueAt: formatZonedLocalInput(defaults?.dueAt, timezone),
    startAt: formatZonedLocalInput(defaults?.startAt, timezone),
  }))

  function applySchedulePreset(preset: "clear" | "today" | "tomorrow") {
    if (preset === "clear") {
      setSchedule({ dueAt: "", startAt: "" })
      return
    }

    if (preset === "today") {
      const start = new Date(Math.ceil((Date.now() + 1) / 900_000) * 900_000)
      setSchedule({
        dueAt: formatZonedLocalInput(
          new Date(start.getTime() + 2 * 60 * 60_000),
          timezone,
        ),
        startAt: formatZonedLocalInput(start, timezone),
      })
      return
    }

    const today = formatZonedLocalInput(new Date(), timezone).slice(0, 10)
    const tomorrow = new Date(`${today}T12:00:00Z`)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const date = tomorrow.toISOString().slice(0, 10)
    setSchedule({ dueAt: `${date}T17:00`, startAt: `${date}T09:00` })
  }

  function updateSchedule(
    key: ScheduleKey,
    part: "date" | "time",
    value: string,
  ) {
    setSchedule((current) => {
      const existing = scheduleParts(current[key])

      if (part === "date" && !value) {
        return { ...current, [key]: "" }
      }

      const date = part === "date" ? value : existing.date
      const fallbackTime = key === "startAt" ? "09:00" : "17:00"
      const requested =
        part === "time" ? value || fallbackTime : existing.time || fallbackTime
      // Picking today pulls any earlier time forward to the current minute, so
      // the form cannot hold a window that has already closed.
      const time =
        enforceFuture && date === earliestDate && requested < earliestTime
          ? earliestTime
          : requested

      return { ...current, [key]: date ? `${date}T${time}` : "" }
    })
  }

  const assignmentFields =
    hasGateOptions || eligibleParents.length || currentParentMissing ? (
      <div className="quest-fields__assignments">
        {hasGateOptions ? (
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-gate`}>List</Label>
            <select
              className={selectClass}
              defaultValue={defaults?.projectId ?? ""}
              id={`${idPrefix}-gate`}
              name="projectId"
            >
              <option value="">No List</option>
              {currentGateMissing ? (
                <option value={defaults.projectId ?? undefined}>
                  {defaults.gateName ?? "Unavailable list"}
                </option>
              ) : null}
              {gates?.map((gate) => (
                <option key={gate.id} value={gate.id}>
                  {gate.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {eligibleParents?.length || currentParentMissing ? (
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-parent`}>Parent task</Label>
            <select
              className={selectClass}
              defaultValue={defaults?.parentTaskId ?? ""}
              id={`${idPrefix}-parent`}
              name="parentTaskId"
            >
              <option value="">Top-level task</option>
              {currentParentMissing ? (
                <option value={defaults.parentTaskId ?? undefined}>
                  Current parent (outside available options)
                </option>
              ) : null}
              {eligibleParents.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-muted">
              Subtasks nest at most two levels deep.
            </p>
          </div>
        ) : null}
      </div>
    ) : null

  return (
    <div className={createMode ? "quest-fields" : "grid gap-4"}>
      <div className={createMode ? "quest-fields__title" : "grid gap-2"}>
        <Label htmlFor={`${idPrefix}-title`}>Task title</Label>
        <Input
          aria-describedby={fieldErrors?.title ? titleErrorId : undefined}
          aria-invalid={Boolean(fieldErrors?.title)}
          autoComplete="off"
          defaultValue={defaults?.title}
          id={`${idPrefix}-title`}
          maxLength={160}
          name="title"
          placeholder="Name the outcome you want"
          required
        />
        <FieldError errors={fieldErrors?.title} id={titleErrorId} />
      </div>

      <div className={createMode ? "quest-fields__description" : "grid gap-2"}>
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <textarea
          aria-describedby={
            fieldErrors?.description ? descriptionErrorId : undefined
          }
          aria-invalid={Boolean(fieldErrors?.description)}
          className="min-h-24 w-full resize-y rounded-control border border-input bg-surface-inset px-3 py-2 text-sm leading-6 text-ink outline-none placeholder:text-ink-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          defaultValue={defaults?.description}
          id={`${idPrefix}-description`}
          maxLength={5_000}
          name="description"
          placeholder="Add notes, context, or the first step…"
        />
        <FieldError errors={fieldErrors?.description} id={descriptionErrorId} />
      </div>

      <div className={createMode ? "quest-fields__planning" : "grid gap-4"}>
        {createMode ? (
          <fieldset className="quest-priority">
            <legend>Priority</legend>
            <div className="quest-priority__options">
              {priorities.map((priority) => (
                <label key={priority.value}>
                  <input
                    defaultChecked={
                      (defaults?.priority ?? "medium") === priority.value
                    }
                    name="priority"
                    type="radio"
                    value={priority.value}
                  />
                  <span data-priority={priority.value}>{priority.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-priority`}>Priority</Label>
            <select
              aria-describedby={
                fieldErrors?.priority ? priorityErrorId : undefined
              }
              aria-invalid={Boolean(fieldErrors?.priority)}
              className="h-8 w-full rounded-control border border-input bg-surface-inset px-2.5 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              defaultValue={defaults?.priority ?? "medium"}
              id={`${idPrefix}-priority`}
              name="priority"
            >
              {priorities.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <FieldError errors={fieldErrors?.priority} id={priorityErrorId} />

        <fieldset className="quest-schedule">
          <div className="quest-schedule__heading">
            <div>
              <legend>
                <CalendarDays aria-hidden="true" />
                Schedule
              </legend>
              <p>Set a time window, or leave the task flexible.</p>
            </div>
            <span className="quest-schedule__timezone" title={timezone}>
              <Clock3 aria-hidden="true" />
              {zoneLabel}
            </span>
          </div>

          <div
            aria-label="Schedule presets"
            className="quest-schedule__presets"
          >
            <button onClick={() => applySchedulePreset("today")} type="button">
              Today · 2 hours
            </button>
            <button
              onClick={() => applySchedulePreset("tomorrow")}
              type="button"
            >
              Tomorrow · 9–5
            </button>
            <button onClick={() => applySchedulePreset("clear")} type="button">
              <RotateCcw aria-hidden="true" />
              Clear
            </button>
          </div>

          <div className="quest-schedule__range">
            {(
              [
                {
                  error: fieldErrors?.startAt,
                  errorId: startErrorId,
                  key: "startAt",
                  label: "Starts",
                },
                {
                  error: fieldErrors?.dueAt,
                  errorId: dueErrorId,
                  key: "dueAt",
                  label: "Due",
                },
              ] as const
            ).map((moment) => {
              const parts = scheduleParts(schedule[moment.key])
              const labelPrefix = moment.key === "startAt" ? "Start" : "Due"

              return (
                <div className="quest-schedule__moment" key={moment.key}>
                  <div className="quest-schedule__moment-title">
                    <span aria-hidden="true" />
                    <strong>{moment.label}</strong>
                    <small>{parts.date ? "Scheduled" : "Not set"}</small>
                  </div>

                  <input
                    name={moment.key}
                    type="hidden"
                    value={schedule[moment.key]}
                  />

                  <div className="quest-schedule__controls">
                    <div className="quest-schedule__control">
                      <Label htmlFor={`${idPrefix}-${moment.key}-date`}>
                        Date
                      </Label>
                      <QuestDatePicker
                        ariaDescribedby={
                          moment.error ? moment.errorId : undefined
                        }
                        ariaInvalid={Boolean(moment.error)}
                        ariaLabel={`${labelPrefix} date · ${zoneLabel}`}
                        id={`${idPrefix}-${moment.key}-date`}
                        minDate={earliestDate}
                        onChange={(value) =>
                          updateSchedule(moment.key, "date", value)
                        }
                        value={parts.date}
                      />
                    </div>

                    <div className="quest-schedule__control">
                      <Label htmlFor={`${idPrefix}-${moment.key}-time`}>
                        Time
                      </Label>
                      <QuestTimePicker
                        ariaDescribedby={
                          moment.error ? moment.errorId : undefined
                        }
                        ariaInvalid={Boolean(moment.error)}
                        ariaLabel={`${labelPrefix} time · ${zoneLabel}`}
                        disabled={!parts.date}
                        id={`${idPrefix}-${moment.key}-time`}
                        minTime={
                          enforceFuture && parts.date === earliestDate
                            ? earliestTime
                            : undefined
                        }
                        onChange={(value) =>
                          updateSchedule(moment.key, "time", value)
                        }
                        value={parts.time}
                      />
                    </div>
                  </div>

                  <FieldError errors={moment.error} id={moment.errorId} />
                </div>
              )
            })}
          </div>
        </fieldset>
      </div>

      {createMode ? (
        <details
          className="quest-fields__advanced"
          open={fieldErrors?.recurrenceRule ? true : undefined}
        >
          <summary>
            <span>More options</span>
            <small>
              {assignmentFields ? "Repeat and organise" : "Repeat schedule"}
            </small>
          </summary>
          <div className="quest-fields__advanced-body">
            <QuestRecurrenceFields
              defaultValue={defaults?.recurrenceRule}
              error={fieldErrors?.recurrenceRule?.[0]}
              idPrefix={idPrefix}
              timezone={timezone}
            />
            {assignmentFields}
          </div>
        </details>
      ) : (
        <>
          <QuestRecurrenceFields
            defaultValue={defaults?.recurrenceRule}
            error={fieldErrors?.recurrenceRule?.[0]}
            idPrefix={idPrefix}
            timezone={timezone}
          />
          {assignmentFields}
        </>
      )}
    </div>
  )
}
