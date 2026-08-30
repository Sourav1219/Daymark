"use client"

import { useRef, useState } from "react"
import { ChevronDown, Clock3 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const timeOptions = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4)
  const minutes = (index % 4) * 15
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
  const label = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hours, minutes))

  return { label, value }
})

const exactTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/u

function pickerPortal(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined

  return (
    document.querySelector<HTMLElement>(".device-main-viewport") ?? undefined
  )
}

export function QuestTimePicker({
  ariaDescribedby,
  ariaInvalid,
  ariaLabel,
  disabled,
  id,
  minTime,
  onChange,
  value,
}: Readonly<{
  ariaDescribedby?: string | undefined
  ariaInvalid?: boolean | undefined
  ariaLabel: string
  disabled: boolean
  id: string
  /** Earlier choices are visibly unavailable when the selected date is today. */
  minTime?: string | undefined
  onChange: (value: string) => void
  value: string
}>) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const exactInputRef = useRef<HTMLInputElement>(null)
  const draftIsComplete = exactTimePattern.test(draft)
  const draftIsElapsed = Boolean(draftIsComplete && minTime && draft < minTime)
  const draftIsUsable = draftIsComplete && !draftIsElapsed
  const visibleTimeOptions = minTime
    ? timeOptions.filter((option) => option.value >= minTime)
    : timeOptions
  const portal = pickerPortal()

  function updateExactTime(next: string) {
    // Native time inputs temporarily emit an empty value while a person edits
    // individual hour/minute segments. Keep that draft local so the parent
    // does not replace it with its 09:00/17:00 fallback mid-entry.
    setDraft(next)
    if (exactTimePattern.test(next) && (!minTime || next >= minTime)) {
      onChange(next)
    }
  }

  function acceptExactTime() {
    const next = exactInputRef.current?.value ?? draft
    if (!exactTimePattern.test(next) || (minTime && next < minTime)) return

    onChange(next)
    setOpen(false)
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (nextOpen) setDraft(value)
        setOpen(nextOpen)
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button
          aria-describedby={ariaDescribedby}
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          className={cn(
            "quest-time-trigger",
            !value && "quest-time-trigger--empty",
          )}
          disabled={disabled}
          id={id}
          type="button"
          variant="outline"
        >
          <Clock3 aria-hidden="true" />
          <span>{value || "Choose time"}</span>
          <ChevronDown
            aria-hidden="true"
            className="quest-time-trigger__chevron"
          />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="quest-time-popover quest-picker-dialog"
        overlayClassName="quest-picker-dialog__overlay"
        {...(portal ? { portalContainer: portal } : {})}
      >
        <div className="quest-time-popover__header">
          <Clock3 aria-hidden="true" />
          <div>
            <DialogTitle>Choose an exact time</DialogTitle>
            <DialogDescription>
              Enter any minute, or use a 15-minute shortcut.
            </DialogDescription>
          </div>
        </div>

        <div className="quest-time-popover__exact">
          <label htmlFor={`${id}-exact`}>Exact time</label>
          <Input
            aria-label={`${ariaLabel} exact value`}
            id={`${id}-exact`}
            min={minTime}
            onChange={(event) => updateExactTime(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                acceptExactTime()
              }
            }}
            ref={exactInputRef}
            step={60}
            type="time"
            value={draft}
          />
          <div className="quest-time-popover__exact-footer">
            <p aria-live="polite">
              {draftIsElapsed
                ? `Choose ${minTime} or later for today.`
                : !draftIsComplete && draft
                  ? "Enter a complete time."
                  : minTime
                    ? "Earlier times today are unavailable."
                    : "Use any hour and minute."}
            </p>
            <button
              disabled={!draftIsUsable}
              onClick={acceptExactTime}
              type="button"
            >
              Use time
            </button>
          </div>
        </div>

        <div aria-label="Time shortcuts" className="quest-time-popover__grid">
          {visibleTimeOptions.length > 0 ? (
            visibleTimeOptions.map((option) => (
              <button
                aria-label={option.label}
                aria-pressed={option.value === value}
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                type="button"
              >
                {option.label}
              </button>
            ))
          ) : (
            <p className="quest-time-popover__empty">
              No 15-minute shortcuts remain today. Enter an exact future time
              above.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
