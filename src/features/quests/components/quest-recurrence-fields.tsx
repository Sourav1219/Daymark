"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Repeat2 } from "lucide-react"

import { Label } from "@/components/ui/label"
import {
  calculateNextOccurrence,
  normalizeRecurrenceRule,
} from "@/features/reminders/domain/recurrence"
import {
  formatZonedDateTime,
  parseZonedLocalDateTime,
} from "@/features/reminders/domain/timezone"

const repeatOptions = [
  { label: "Doesn't repeat", value: "" },
  { label: "Every day", value: "RRULE:FREQ=DAILY" },
  { label: "Every week", value: "RRULE:FREQ=WEEKLY" },
  {
    label: "Every weekday",
    value: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  },
  { label: "Every month", value: "RRULE:FREQ=MONTHLY" },
  { label: "Every year", value: "RRULE:FREQ=YEARLY" },
] as const

export function QuestRecurrenceFields({
  defaultValue,
  error,
  idPrefix,
  timezone,
}: Readonly<{
  defaultValue?: string | null | undefined
  error?: string | undefined
  idPrefix: string
  timezone: string
}>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState("This task happens once.")
  const errorId = `${idPrefix}-recurrence-error`
  const customDefault =
    defaultValue &&
    !repeatOptions.some((option) => option.value === defaultValue)

  const updatePreview = useCallback(() => {
    const form = containerRef.current?.closest("form")
    if (!form) return

    const data = new FormData(form)
    const ruleValue = String(data.get("recurrenceRule") ?? "").trim()

    if (!ruleValue) {
      setPreview("This task happens once.")
      return
    }

    const dueValue = String(data.get("dueAt") ?? "")
    const startValue = String(data.get("startAt") ?? "")
    const anchor =
      parseZonedLocalDateTime(dueValue, timezone) ??
      parseZonedLocalDateTime(startValue, timezone)

    if (!anchor) {
      setPreview("Add a start or due time to preview the next task.")
      return
    }

    try {
      const next = calculateNextOccurrence(
        normalizeRecurrenceRule(ruleValue),
        timezone,
        anchor,
      )
      setPreview(
        next
          ? `Next quest: ${formatZonedDateTime(next, timezone)}`
          : "This schedule has no future task.",
      )
    } catch {
      setPreview("Choose a repeat option to continue.")
    }
  }, [timezone])

  useEffect(() => {
    const form = containerRef.current?.closest("form")
    if (!form) return

    updatePreview()
    form.addEventListener("input", updatePreview)
    return () => form.removeEventListener("input", updatePreview)
  }, [updatePreview])

  return (
    <div className="quest-repeat" ref={containerRef}>
      <Label className="quest-repeat__label" htmlFor={`${idPrefix}-recurrence`}>
        <Repeat2 aria-hidden="true" />
        Repeat
      </Label>
      <select
        aria-describedby={error ? errorId : `${idPrefix}-recurrence-preview`}
        aria-invalid={Boolean(error)}
        className="quest-repeat__select"
        defaultValue={defaultValue ?? ""}
        id={`${idPrefix}-recurrence`}
        name="recurrenceRule"
      >
        {customDefault ? (
          <option value={defaultValue}>Custom repeat schedule</option>
        ) : null}
        {repeatOptions.map((option) => (
          <option key={option.value || "once"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="text-xs leading-5 text-danger" id={errorId}>
          {error}
        </p>
      ) : (
        <p
          aria-live="polite"
          className="quest-repeat__preview"
          id={`${idPrefix}-recurrence-preview`}
        >
          {preview}
        </p>
      )}
    </div>
  )
}
