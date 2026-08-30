import {
  ArrowUp,
  CalendarDays,
  Flame,
  History,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react"

import "@/app/styles/progress-page.css"

import { LoadingPlaceholder } from "@/components/system/loading-placeholder"

export function ProgressLoadingState() {
  return (
    <div
      aria-label="Loading Your progress"
      className="progress-page exact-route-loading"
      role="status"
    >
      <span className="sr-only">Loading Your progress</span>
      <header className="progress-header">
        <div>
          <span>Personal growth</span>
          <h1>Your progress</h1>
          <p>Every completed task adds to your momentum.</p>
        </div>
      </header>

      <section aria-hidden="true" className="progress-summary-card">
        <span className="progress-summary-card__orb progress-summary-card__orb--one" />
        <span className="progress-summary-card__orb progress-summary-card__orb--two" />
        <div className="progress-summary-card__topline">
          <div className="progress-summary-card__identity">
            <span className="progress-summary-card__crest">
              <Sparkles />
            </span>
            <div>
              <span>All-time progress</span>
              <strong>Built one task at a time</strong>
            </div>
          </div>
          <span className="progress-summary-card__level-badge">
            <ArrowUp />{" "}
            <LoadingPlaceholder className="exact-loading__percent" />
          </span>
        </div>
        <div className="progress-level">
          <div className="progress-level__headline">
            <div className="progress-level__current">
              <span>Current level</span>
              <strong>
                <LoadingPlaceholder className="exact-loading__level" />
              </strong>
            </div>
            <div className="progress-level__target">
              <span>Next milestone</span>
              <strong>
                Level{" "}
                <LoadingPlaceholder className="exact-loading__inline-number" />
              </strong>
              <small>
                <LoadingPlaceholder className="exact-loading__inline-value" />{" "}
                points away
              </small>
            </div>
          </div>
          <div className="progress-meter progress-meter--level">
            <span />
          </div>
          <div className="progress-level__footer">
            <span>
              <LoadingPlaceholder className="exact-loading__inline-value" />{" "}
              points
            </span>
            <span>
              <LoadingPlaceholder className="exact-loading__inline-value" />{" "}
              complete
            </span>
          </div>
          <p className="progress-level__hint">
            <Sparkles /> Every completed task moves you forward.
          </p>
        </div>
      </section>

      <section aria-hidden="true" className="progress-section">
        <div className="progress-section__heading">
          <div>
            <span>Keep moving</span>
            <h2>Your momentum</h2>
          </div>
          <p>Goals reset in your local timezone.</p>
        </div>
        <div className="progress-pace-grid">
          <ProgressMeasureLoading icon="target" label="Today" tone="daily" />
          <ProgressMeasureLoading
            icon="calendar"
            label="This week"
            tone="weekly"
          />
        </div>
        <article className="progress-streak-card" data-active="false">
          <span className="progress-streak-card__orb progress-streak-card__orb--one" />
          <span className="progress-streak-card__orb progress-streak-card__orb--two" />
          <div className="progress-streak-card__intro">
            <span className="progress-streak-card__icon">
              <Flame />
              <Sparkles />
            </span>
            <div>
              <span>Consistency streak</span>
              <h3>Building your momentum</h3>
              <p>Complete at least one task each day to keep it alive.</p>
            </div>
          </div>
          <dl>
            <div data-primary="true">
              <dt>
                <Flame /> Current
              </dt>
              <dd>
                <strong>
                  <LoadingPlaceholder className="exact-loading__streak" />
                </strong>
                <span>days</span>
              </dd>
            </div>
            <div>
              <dt>
                <Trophy /> Best
              </dt>
              <dd>
                <strong>
                  <LoadingPlaceholder className="exact-loading__streak" />
                </strong>
                <span>days</span>
              </dd>
            </div>
          </dl>
          <div className="progress-streak-card__note">
            <CalendarDays />
            <span>One completion today protects your current run.</span>
          </div>
        </article>
      </section>

      <section aria-hidden="true" className="progress-history">
        <div className="progress-section__heading">
          <div>
            <span>Recent wins</span>
            <h2>Progress history</h2>
          </div>
          <History />
        </div>
        <div className="progress-history-days">
          <section className="progress-history-day">
            <div className="progress-history-day__heading">
              <div>
                <CalendarDays />
                <LoadingPlaceholder className="exact-loading__history-date" />
              </div>
              <LoadingPlaceholder className="exact-loading__history-points" />
            </div>
            <ol className="progress-timeline">
              <li data-positive="true">
                <span className="progress-timeline__marker">
                  <TrendingUp />
                </span>
                <div className="progress-timeline__body">
                  <LoadingPlaceholder className="exact-loading__line exact-loading__line--title" />
                  <LoadingPlaceholder className="exact-loading__line exact-loading__line--body" />
                </div>
                <LoadingPlaceholder className="exact-loading__history-points" />
              </li>
            </ol>
          </section>
        </div>
      </section>
    </div>
  )
}

function ProgressMeasureLoading({
  icon,
  label,
  tone,
}: Readonly<{
  icon: "calendar" | "target"
  label: string
  tone: "daily" | "weekly"
}>) {
  const Icon = icon === "target" ? Target : CalendarDays

  return (
    <article className="progress-pace-card" data-tone={tone}>
      <div className="progress-pace-card__topline">
        <span className="progress-pace-card__icon">
          <Icon />
        </span>
        <LoadingPlaceholder className="exact-loading__percent" />
      </div>
      <div>
        <h3>{label}</h3>
        <p>
          <strong>
            <LoadingPlaceholder className="exact-loading__inline-number" />
          </strong>{" "}
          points
        </p>
        <small>Earned from scheduled tasks</small>
      </div>
      <div className="progress-meter progress-meter--compact">
        <span />
      </div>
    </article>
  )
}
