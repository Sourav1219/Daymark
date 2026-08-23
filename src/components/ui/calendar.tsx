"use client"

import * as React from "react"
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
} from "react-day-picker"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function Calendar({
  captionLayout = "label",
  className,
  classNames,
  components,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames()

  return (
    <DayPicker
      captionLayout={captionLayout}
      className={cn(
        "group/calendar bg-background p-3 [--cell-radius:12px] [--cell-size:2.35rem]",
        className,
      )}
      classNames={{
        button_next: cn(
          "inline-flex size-(--cell-size) items-center justify-center rounded-full text-foreground transition-colors hover:bg-system-blue/10 hover:text-system-blue focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35 aria-disabled:opacity-45",
          defaults.button_next,
        ),
        button_previous: cn(
          "inline-flex size-(--cell-size) items-center justify-center rounded-full text-foreground transition-colors hover:bg-system-blue/10 hover:text-system-blue focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35 aria-disabled:opacity-45",
          defaults.button_previous,
        ),
        caption_label: cn(
          "text-sm font-black text-foreground select-none",
          defaults.caption_label,
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none",
          defaults.day,
        ),
        disabled: cn("text-muted-foreground opacity-35", defaults.disabled),
        hidden: cn("invisible", defaults.hidden),
        month: cn("flex w-full flex-col gap-3", defaults.month),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaults.month_caption,
        ),
        month_grid: cn("w-full border-collapse", defaults.month_grid),
        months: cn("relative flex flex-col gap-4", defaults.months),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between",
          defaults.nav,
        ),
        outside: cn(
          "text-muted-foreground/45 aria-selected:text-muted-foreground",
          defaults.outside,
        ),
        root: cn("w-fit", defaults.root),
        today: cn(
          "rounded-(--cell-radius) bg-system-blue/10 text-system-blue",
          defaults.today,
        ),
        week: cn("mt-1 flex w-full", defaults.week),
        weekday: cn(
          "flex-1 text-[0.68rem] font-black tracking-[0.08em] text-muted-foreground uppercase select-none",
          defaults.weekday,
        ),
        weekdays: cn("flex", defaults.weekdays),
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...chevronProps }) => {
          const Icon =
            orientation === "left"
              ? ChevronLeft
              : orientation === "right"
                ? ChevronRight
                : ChevronDown
          return <Icon className={cn("size-4", className)} {...chevronProps} />
        },
        DayButton: (dayProps) => <CalendarDayButton {...dayProps} />,
        Root: ({ className: rootClassName, rootRef, ...rootProps }) => (
          <div
            className={cn(rootClassName)}
            data-slot="calendar"
            ref={rootRef}
            {...rootProps}
          />
        ),
        ...components,
      }}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      className={cn(
        "relative isolate z-10 aspect-square size-auto w-full min-w-(--cell-size) border-0 text-xs font-extrabold data-[selected-single=true]:bg-system-blue data-[selected-single=true]:text-white data-[selected-single=true]:shadow-glow-blue",
        className,
      )}
      data-day={day.date.toLocaleDateString()}
      data-selected-single={modifiers.selected}
      ref={ref}
      size="icon"
      variant="ghost"
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
