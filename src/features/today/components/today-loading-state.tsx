function LoadingLine({ className = "" }: Readonly<{ className?: string }>) {
  return <span className={`today-loading__surface ${className}`} />
}

export function TodayLoadingState() {
  return (
    <div
      aria-label="Loading your day"
      className="today-page today-loading"
      role="status"
    >
      <span className="sr-only">Loading your day</span>

      <header aria-hidden="true" className="today-topbar">
        <div className="today-topbar__row">
          <div className="today-loading__heading-copy">
            <LoadingLine className="today-loading__eyebrow" />
            <LoadingLine className="today-loading__title" />
          </div>
          <div className="today-topbar__actions">
            <LoadingLine className="today-loading__action" />
            <LoadingLine className="today-loading__action today-loading__streak" />
          </div>
        </div>

        <div className="today-date-nav today-loading__date-nav">
          <LoadingLine className="today-loading__arrow" />
          <div className="today-week">
            {["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map(
              (day, index) => (
                <span className="today-day" key={day}>
                  <LoadingLine className="today-loading__day-name" />
                  <LoadingLine
                    className={`today-loading__day-number${index === 3 ? " is-selected" : ""}`}
                  />
                </span>
              ),
            )}
          </div>
          <LoadingLine className="today-loading__arrow" />
        </div>
      </header>

      <div aria-hidden="true" className="today-loading__chips">
        <LoadingLine className="today-loading__chip is-active" />
        <LoadingLine className="today-loading__chip" />
        <LoadingLine className="today-loading__chip" />
      </div>

      <section
        aria-hidden="true"
        className="today-section today-loading__tasks"
        data-primary="true"
      >
        <div className="today-section__heading">
          <div className="today-loading__section-copy">
            <LoadingLine className="today-loading__section-kicker" />
            <LoadingLine className="today-loading__section-title" />
          </div>
          <LoadingLine className="today-loading__count" />
        </div>

        <div className="today-section__cards">
          <TodayLoadingCard tone="blue" />
          <TodayLoadingCard tone="violet" />
          <TodayLoadingCard tone="sky" />
        </div>
      </section>
    </div>
  )
}

function TodayLoadingCard({
  tone,
}: Readonly<{ tone: "blue" | "sky" | "violet" }>) {
  return (
    <div className="today-loading__card" data-tone={tone}>
      <LoadingLine className="today-loading__card-icon" />
      <span className="today-loading__card-copy">
        <LoadingLine className="today-loading__card-title" />
        <span className="today-loading__card-meta">
          <LoadingLine />
          <LoadingLine />
        </span>
      </span>
      <LoadingLine className="today-loading__card-action" />
    </div>
  )
}

export function DailyStudyHistoryLoading() {
  return (
    <section
      aria-label="Loading study history"
      className="today-section daily-study today-loading__study"
      role="status"
    >
      <span className="sr-only">Loading study history</span>
      <div aria-hidden="true" className="today-section__heading">
        <LoadingLine className="today-loading__study-title" />
        <LoadingLine className="today-loading__count" />
      </div>
      <div aria-hidden="true" className="today-loading__study-card">
        <LoadingLine className="today-loading__study-icon" />
        <span className="today-loading__card-copy">
          <LoadingLine className="today-loading__study-line" />
          <LoadingLine className="today-loading__study-subline" />
        </span>
      </div>
    </section>
  )
}
