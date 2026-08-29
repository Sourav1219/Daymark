"use client"

import { useState } from "react"
import { Repeat2 } from "lucide-react"

import { Label } from "@/components/ui/label"

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
}: Readonly<{
  defaultValue?: string | null | undefined
  error?: string | undefined
  idPrefix: string
  timezone: string
}>) {
  const [selectedRule, setSelectedRule] = useState(defaultValue ?? "")
  const errorId = `${idPrefix}-recurrence-error`
  const customDefault =
    defaultValue &&
    !repeatOptions.some((option) => option.value === defaultValue)

  const preview = selectedRule
    ? "The next task will be scheduled after this one is completed."
    : "This task happens once."

  return (
    <div className="quest-repeat">
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
        onChange={(event) => setSelectedRule(event.currentTarget.value)}
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
