"use client"

import { useState } from "react"
import { format } from "date-fns"
import { CalendarDays, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

function calendarDate(value: string): Date | undefined {
  const [year, month, day] = value.split("-").map(Number)
  return year && month && day ? new Date(year, month - 1, day, 12) : undefined
}

function calendarValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
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

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
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
            {selected ? format(selected, "d MMM yyyy") : "Choose date"}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="quest-date-trigger__chevron"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="quest-date-popover w-auto gap-0 overflow-hidden rounded-[22px] border-0 p-0"
        sideOffset={8}
      >
        <div className="quest-date-popover__header">
          <CalendarDays aria-hidden="true" />
          <div>
            <strong>Select a date</strong>
            <span>
              {selected ? format(selected, "EEEE, d MMMM") : "No date selected"}
            </span>
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
      </PopoverContent>
    </Popover>
  )
}
