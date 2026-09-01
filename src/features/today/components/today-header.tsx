"use client"

import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { StreakButton } from "@/features/progression/components/streak-button"
import { NotificationMenu } from "@/features/reminders/components/notification-menu"
import type { ReminderInboxData } from "@/features/reminders/domain/types"

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

type TodayHeaderProps = Readonly<{
  activeLabelId?: string
  inbox: ReminderInboxData
  referenceNow: string
  onDateNavigate?: (date: string) => void
  selectedDate: string
  streak: number
  todayDate: string
  timezone: string
}>

function utcDate(value: string): Date {
  return new Date(`${value}T12:00:00Z`)
}

function dateValue(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(value: string, amount: number): string {
  const date = utcDate(value)
  date.setUTCDate(date.getUTCDate() + amount)
  return dateValue(date)
}

export function TodayHeader({
  activeLabelId,
  inbox,
  referenceNow,
  onDateNavigate,
  selectedDate,
  streak,
  todayDate,
  timezone,
}: TodayHeaderProps) {
  const dateHref = (date: string) => ({
    pathname: "/today",
    query: {
      date,
      ...(activeLabelId && activeLabelId !== "any"
        ? { labelId: activeLabelId }
        : {}),
    },
  })
  const anchor = utcDate(selectedDate)
  const weekday = anchor.getUTCDay()
  const days = dayNames.map((name, offset) => {
    const day = new Date(anchor)
    day.setUTCDate(anchor.getUTCDate() - weekday + offset)
    const value = dateValue(day)

    return {
      disabled: value > todayDate,
      isSelected: value === selectedDate,
      name,
      num: day.getUTCDate(),
      value,
    }
  })
  const displayDate = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    weekday: "short",
    year: "numeric",
  }).format(anchor)
  const previousDate = addDays(selectedDate, -1)
  const nextDate = addDays(selectedDate, 1)

  return (
    <header className="today-topbar">
      <div className="today-topbar__row">
        <div>
          <span className="today-topbar__eyebrow">Daily activity</span>
          <h1 className="today-topbar__title">{displayDate}</h1>
        </div>
        <div className="today-topbar__actions">
          <NotificationMenu
            inbox={inbox}
            referenceNow={referenceNow}
            timezone={timezone}
          />
          <StreakButton streak={streak} />
        </div>
      </div>

      <nav aria-label="Choose activity date" className="today-date-nav">
        <Link
          aria-label="Previous day"
          className="today-date-nav__arrow"
          href={dateHref(previousDate)}
          onNavigate={() => onDateNavigate?.(previousDate)}
          prefetch
        >
          <ChevronLeft aria-hidden="true" />
        </Link>
        <div className="today-week">
          {days.map((day) =>
            day.disabled ? (
              <span
                aria-disabled="true"
                className="today-day"
                data-selected={false}
                key={day.value}
              >
                <span className="today-day__name">{day.name}</span>
                <span className="today-day__num">{day.num}</span>
              </span>
            ) : (
              <Link
                aria-current={day.isSelected ? "date" : undefined}
                className="today-day"
                data-selected={day.isSelected}
                href={dateHref(day.value)}
                key={day.value}
                onNavigate={() => onDateNavigate?.(day.value)}
                prefetch
              >
                <span className="today-day__name">{day.name}</span>
                <span className="today-day__num">{day.num}</span>
              </Link>
            ),
          )}
        </div>
        {nextDate <= todayDate ? (
          <Link
            aria-label="Next day"
            className="today-date-nav__arrow"
            href={dateHref(nextDate)}
            onNavigate={() => onDateNavigate?.(nextDate)}
            prefetch
          >
            <ChevronRight aria-hidden="true" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="today-date-nav__arrow today-date-nav__arrow--disabled"
          >
            <ChevronRight aria-hidden="true" />
          </span>
        )}
      </nav>
    </header>
  )
}
