import { Flame, Sparkles } from "lucide-react"

import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { getProgressionDashboard } from "@/features/progression/queries/progression-query-service"
import { formatDateTimeParts } from "@/lib/formatting/date"

function localHour(now: Date, timeZone: string): number {
  const value = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone,
  }).format(now)

  return Number.parseInt(value, 10) % 24
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Good night"
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  if (hour < 22) return "Good evening"
  return "Working late"
}

function XpCore({ percent }: Readonly<{ percent: number }>) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, percent))
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="today-ring">
      <svg
        aria-hidden="true"
        className="today-ring__svg -rotate-90"
        viewBox="0 0 104 104"
      >
        <circle
          cx="52"
          cy="52"
          fill="none"
          r={radius}
          stroke="var(--surface-inset)"
          strokeWidth="8"
        />
        <circle
          cx="52"
          cy="52"
          fill="none"
          r={radius}
          stroke="url(#xp-core-gradient)"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="8"
        />
        <defs>
          <linearGradient id="xp-core-gradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="var(--accent-blue)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="today-ring__label">
        <span className="today-ring__pct">{clamped}%</span>
        <span className="today-ring__sub">Goal</span>
      </div>
    </div>
  )
}

export async function TodayHero({ access }: { access: AccessContext }) {
  const progress = await getProgressionDashboard(access)
  const now = new Date()
  const hour = localHour(now, progress.timezone)
  const dateLabel = (() => {
    const parts = formatDateTimeParts(now, progress.timezone, {
      day: "numeric",
      month: "long",
      weekday: "long",
    })
    return `${parts.weekday}, ${parts.day} ${parts.month}`
  })()

  const remaining = Math.max(0, progress.daily.goal - progress.daily.xp)
  const goalCleared = remaining === 0

  return (
    <header className="today-hero enter-up">
      <div aria-hidden="true" className="today-hero__grid" />

      <div className="today-hero__top">
        <span className="today-eyebrow">
          <span aria-hidden="true" className="today-eyebrow__dot" />
          Today
        </span>
        <span className="today-points">{progress.totalXp} points</span>
      </div>

      <div className="today-hero__titles">
        <h1 className="today-hero__title">{greetingFor(hour)}.</h1>
        <p className="today-hero__tagline">{dateLabel}</p>
      </div>

      <div aria-hidden="true" className="today-divider">
        <span className="today-divider__gem" />
      </div>

      <div className="today-progress">
        <XpCore percent={progress.daily.percent} />
        <div className="today-progress__meta">
          <p className="today-progress__label">Daily goal</p>
          <p className="today-progress__value">
            {progress.daily.xp}
            <span> / {progress.daily.goal} points</span>
          </p>
          <p
            className={`today-progress__hint${goalCleared ? " is-complete" : ""}`}
          >
            {goalCleared
              ? "Daily goal cleared"
              : `${remaining} points to today's goal`}
          </p>
        </div>
      </div>

      <dl className="today-rail">
        <div className="today-stat today-stat--streak">
          <dt className="today-stat__label">
            <Flame aria-hidden="true" className="flame-icon" />
            Streak
          </dt>
          <dd className="today-stat__value">
            {progress.currentStreak}
            <span>{progress.currentStreak === 1 ? "day" : "days"}</span>
          </dd>
        </div>
        <div className="today-stat">
          <dt className="today-stat__label">
            <Sparkles aria-hidden="true" />
            Total points
          </dt>
          <dd className="today-stat__value">{progress.totalXp}</dd>
        </div>
      </dl>
    </header>
  )
}
