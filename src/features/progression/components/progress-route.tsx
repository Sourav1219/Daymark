import {
  ArrowUp,
  CalendarDays,
  Flame,
  History,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react"
import Link from "next/link"

import "@/app/styles/progress-page.css"

import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { questHomeHref } from "@/features/quests/domain/quest-links"
import { getProgressionDashboard } from "@/features/progression/queries/progression-query-service"
import { formatZonedDateTime } from "@/features/reminders/domain/timezone"
import { formatLocalDate } from "@/lib/formatting/date"

type ProgressMeasureProps = Readonly<{
  current: number
  goal: number
  label: string
  percent: number
  tone: "daily" | "weekly"
}>

function ProgressMeasure({
  current,
  goal,
  label,
  percent,
  tone,
}: ProgressMeasureProps) {
  const Icon = tone === "daily" ? Target : CalendarDays

  return (
    <article className="progress-pace-card" data-tone={tone}>
      <div className="progress-pace-card__topline">
        <span className="progress-pace-card__icon">
          <Icon aria-hidden="true" />
        </span>
        <span className="progress-pace-card__percent">{percent}%</span>
      </div>
      <div>
        <h3>{label}</h3>
        <p>
          <strong>{current}</strong> / {goal} points
        </p>
        <small>
          {goal > 0 ? "Earned from scheduled tasks" : "No tasks scheduled"}
        </small>
      </div>
      <div
        aria-label={`${label}: ${current} of ${goal} points`}
        aria-valuemax={Math.max(goal, 1)}
        aria-valuemin={0}
        aria-valuenow={Math.max(0, Math.min(current, goal))}
        className="progress-meter progress-meter--compact"
        role="progressbar"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </article>
  )
}

const historyLabels = {
  quest_completion: "Task completed",
  quest_delete_reversal: "Deleted task correction",
  quest_failure_penalty: "Task missed",
  quest_reopen_reversal: "Reopened task correction",
  quest_restore: "Completed task restored",
} as const

export async function ProgressRoute({
  access,
  selectedDate,
  timezone,
}: {
  access: AccessContext
  selectedDate?: string
  timezone?: string
}) {
  const progress = await getProgressionDashboard(access, {
    ...(selectedDate ? { historyDate: selectedDate } : {}),
    ...(timezone ? { timezone } : {}),
  })
  const historyByDate = new Map<string, typeof progress.history>()
  for (const entry of progress.history) {
    const entries = historyByDate.get(entry.earnedForLocalDate) ?? []
    historyByDate.set(entry.earnedForLocalDate, [...entries, entry])
  }

  return (
    <div className="progress-page">
      <header className="progress-header">
        <div>
          <span>Personal growth</span>
          <h1>Your progress</h1>
          <p>Every completed task adds to your momentum.</p>
        </div>
      </header>

      <section aria-label="Progress overview" className="progress-summary-card">
        <span
          aria-hidden="true"
          className="progress-summary-card__orb progress-summary-card__orb--one"
        />
        <span
          aria-hidden="true"
          className="progress-summary-card__orb progress-summary-card__orb--two"
        />

        <div className="progress-summary-card__topline">
          <div className="progress-summary-card__identity">
            <span className="progress-summary-card__crest">
              <Sparkles aria-hidden="true" />
            </span>
            <div>
              <span>All-time progress</span>
              <strong>Built one task at a time</strong>
            </div>
          </div>
          <span className="progress-summary-card__level-badge">
            <ArrowUp aria-hidden="true" /> {progress.level.percent}%
          </span>
        </div>

        <div className="progress-level">
          <div className="progress-level__headline">
            <div className="progress-level__current">
              <span>Current level</span>
              <strong>{progress.level.level}</strong>
            </div>
            <div className="progress-level__target">
              <span>Next milestone</span>
              <strong>Level {progress.level.level + 1}</strong>
              <small>{progress.level.pointsToNextLevel} points away</small>
            </div>
          </div>
          <div
            aria-label={`Level ${progress.level.level} progress: ${progress.level.pointsInLevel} of ${progress.level.pointsForLevel} points`}
            aria-valuemax={progress.level.pointsForLevel}
            aria-valuemin={0}
            aria-valuenow={progress.level.pointsInLevel}
            className="progress-meter progress-meter--level"
            role="progressbar"
          >
            <span style={{ width: `${progress.level.percent}%` }} />
          </div>
          <div className="progress-level__footer">
            <span>
              <strong>{progress.level.pointsInLevel}</strong> /{" "}
              {progress.level.pointsForLevel} points
            </span>
            <span>{progress.level.percent}% complete</span>
          </div>
          <p className="progress-level__hint">
            <Sparkles aria-hidden="true" /> Every completed task moves you
            forward.
          </p>
        </div>
      </section>

      <section aria-labelledby="momentum-heading" className="progress-section">
        <div className="progress-section__heading">
          <div>
            <span>Keep moving</span>
            <h2 id="momentum-heading">Your momentum</h2>
          </div>
          <p>Goals reset in your local timezone.</p>
        </div>

        <div className="progress-pace-grid">
          <ProgressMeasure
            current={progress.daily.xp}
            goal={progress.daily.goal}
            label="Today"
            percent={progress.daily.percent}
            tone="daily"
          />
          <ProgressMeasure
            current={progress.weekly.xp}
            goal={progress.weekly.goal}
            label="This week"
            percent={progress.weekly.percent}
            tone="weekly"
          />
        </div>

        <article
          className="progress-streak-card"
          data-active={progress.currentStreak > 0}
        >
          <span
            aria-hidden="true"
            className="progress-streak-card__orb progress-streak-card__orb--one"
          />
          <span
            aria-hidden="true"
            className="progress-streak-card__orb progress-streak-card__orb--two"
          />
          <div className="progress-streak-card__intro">
            <span className="progress-streak-card__icon">
              <Flame aria-hidden="true" />
              <Sparkles aria-hidden="true" />
            </span>
            <div>
              <span>Consistency streak</span>
              <h3>
                {progress.currentStreak > 0
                  ? "Your momentum is building"
                  : "Start your streak today"}
              </h3>
              <p>Complete at least one task each day to keep it alive.</p>
            </div>
          </div>
          <dl>
            <div data-primary="true">
              <dt>
                <Flame aria-hidden="true" /> Current
              </dt>
              <dd>
                <strong>{progress.currentStreak}</strong>
                <span>{progress.currentStreak === 1 ? "day" : "days"}</span>
              </dd>
            </div>
            <div>
              <dt>
                <Trophy aria-hidden="true" /> Best
              </dt>
              <dd>
                <strong>{progress.bestStreak}</strong>
                <span>{progress.bestStreak === 1 ? "day" : "days"}</span>
              </dd>
            </div>
          </dl>
          <div className="progress-streak-card__note">
            <CalendarDays aria-hidden="true" />
            <span>
              {progress.currentStreak > 0
                ? "One completion today protects your current run."
                : "Your first completed task begins a new run."}
            </span>
          </div>
        </article>
      </section>

      <section
        aria-labelledby="progress-history-heading"
        className="progress-history"
      >
        <div className="progress-section__heading">
          <div>
            <span>Recent wins</span>
            <h2 id="progress-history-heading">Progress history</h2>
          </div>
          <History aria-hidden="true" />
        </div>

        {progress.history.length === 0 ? (
          <div className="progress-history__empty">
            <span>
              <Sparkles aria-hidden="true" />
            </span>
            <h3>No points activity yet</h3>
            <p>Complete an open task to begin your progress history.</p>
          </div>
        ) : (
          <div className="progress-history-days">
            {[...historyByDate].map(([localDate, entries]) => {
              const dailyTotal = entries.reduce(
                (total, entry) => total + entry.xpDelta,
                0,
              )
              const dateLabel = formatLocalDate(localDate)

              return (
                <section className="progress-history-day" key={localDate}>
                  <div className="progress-history-day__heading">
                    <div>
                      <CalendarDays aria-hidden="true" />
                      <h3>{dateLabel}</h3>
                    </div>
                    <strong data-positive={dailyTotal >= 0}>
                      {dailyTotal > 0 ? "+" : ""}
                      {dailyTotal} points
                    </strong>
                  </div>
                  <ol className="progress-timeline">
                    {entries.map((entry, index) => {
                      const positive = entry.xpDelta > 0

                      return (
                        <li
                          data-positive={positive}
                          key={`${entry.occurredAt}-${entry.reason}-${index}`}
                        >
                          <span
                            aria-hidden="true"
                            className="progress-timeline__marker"
                          >
                            {positive ? <Sparkles /> : <History />}
                          </span>
                          <div className="progress-timeline__body">
                            <div>
                              <strong>
                                <Link
                                  className="rounded-sm underline-offset-4 hover:text-system-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                                  href={questHomeHref(
                                    entry.questId,
                                    entry.earnedForLocalDate,
                                  )}
                                >
                                  {entry.questTitle}
                                </Link>
                              </strong>
                              <span>{historyLabels[entry.reason]}</span>
                            </div>
                            <time dateTime={entry.occurredAt}>
                              {formatZonedDateTime(
                                new Date(entry.occurredAt),
                                progress.timezone,
                              )}
                            </time>
                          </div>
                          <span className="progress-timeline__xp">
                            {positive ? "+" : ""}
                            {entry.xpDelta} points
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
