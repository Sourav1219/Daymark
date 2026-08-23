import { BookOpenCheck, CalendarDays, Layers3 } from "lucide-react"

import { formatLocalDate } from "@/lib/formatting/date"
import type { DailyStudySummaryView } from "@/features/timer/domain/types"

function formatStudyDate(localDate: string) {
  return formatLocalDate(localDate)
}

function formatStudyDuration(milliseconds: number) {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function DailyStudyHistory({
  history,
  selectedDate,
}: Readonly<{
  history: readonly DailyStudySummaryView[]
  selectedDate: string
}>) {
  const selectedHistory = history.filter(
    (day) => day.localDate === selectedDate,
  )

  return (
    <section
      aria-labelledby="daily-study-heading"
      className="today-section daily-study"
    >
      <div className="today-section__heading">
        <div>
          <h2 className="today-section__title" id="daily-study-heading">
            Study history
          </h2>
        </div>
        <span>
          {selectedHistory.length}{" "}
          {selectedHistory.length === 1 ? "day" : "days"}
        </span>
      </div>

      {selectedHistory.length === 0 ? (
        <div className="daily-study__empty">
          <BookOpenCheck aria-hidden="true" />
          <div>
            <h3>No study time recorded for this day</h3>
            <p>
              Completed solo and group timers for this date will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="today-section__cards daily-study__list">
          {selectedHistory.map((day) => (
            <article
              className="daily-study__card"
              data-selected="true"
              key={day.localDate}
            >
              <span aria-hidden="true" className="daily-study__icon">
                <CalendarDays />
              </span>
              <div className="daily-study__copy">
                <h3>{formatStudyDate(day.localDate)}</h3>
                <p>
                  <Layers3 aria-hidden="true" /> {day.sessionCount}{" "}
                  {day.sessionCount === 1 ? "session" : "sessions"}
                </p>
              </div>
              <strong>{formatStudyDuration(day.totalMs)}</strong>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
