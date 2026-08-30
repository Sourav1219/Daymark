"use client"

import { useState } from "react"
import { CalendarDays, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const compactDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
})
const expandedDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  weekday: "long",
})

function calendarDate(value: string): Date | undefined {
  const [year, month, day] = value.split("-").map(Number)
  return year && month && day ? new Date(year, month - 1, day, 12) : undefined
}

function calendarValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function pickerPortal(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined

  return (
    document.querySelector<HTMLElement>(".device-main-viewport") ?? undefined
  )
}

export function QuestDatePicker({
  ariaDescribedby,
  ariaInvalid,
  ariaLabel,
  id,
  minDate,
  onChange,
  value,
}: Readonly<{
  ariaDescribedby?: string | undefined
  ariaInvalid?: boolean | undefined
  ariaLabel: string
  id: string
  /** Earliest selectable day as "yyyy-MM-dd"; earlier days render faded. */
  minDate?: string | undefined
  onChange: (value: string) => void
  value: string
}>) {
  const [open, setOpen] = useState(false)
  const selected = calendarDate(value)
  const earliest = minDate ? calendarDate(minDate) : undefined
  const portal = pickerPortal()

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-describedby={ariaDescribedby}
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          className={cn(
            "quest-date-trigger",
            !selected && "quest-date-trigger--empty",
          )}
          id={id}
          type="button"
          variant="outline"
        >
          <CalendarDays aria-hidden="true" />
          <span>
            {selected ? compactDateFormatter.format(selected) : "Choose date"}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="quest-date-trigger__chevron"
          />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="quest-date-popover quest-picker-dialog"
        overlayClassName="quest-picker-dialog__overlay"
        {...(portal ? { portalContainer: portal } : {})}
      >
        <div className="quest-date-popover__header">
          <CalendarDays aria-hidden="true" />
          <div>
            <DialogTitle>Select a date</DialogTitle>
            <DialogDescription>
              {selected
                ? expandedDateFormatter.format(selected)
                : "No date selected"}
            </DialogDescription>
          </div>
        </div>
        <Calendar
          mode="single"
          onSelect={(date) => {
            if (!date) return
            onChange(calendarValue(date))
            setOpen(false)
          }}
          {...(earliest
            ? { disabled: { before: earliest }, startMonth: earliest }
            : {})}
          {...(selected ? { defaultMonth: selected, selected } : {})}
        />
        <div className="quest-date-popover__footer">
          <button
            onClick={() => {
              onChange(calendarValue(new Date()))
              setOpen(false)
            }}
            type="button"
          >
            Today
          </button>
          <button
            disabled={!selected}
            onClick={() => {
              onChange("")
              setOpen(false)
            }}
            type="button"
          >
            Clear date
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
