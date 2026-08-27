import {
  CalendarDays,
  Check,
  Clock3,
  Flag,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  WandSparkles,
} from "lucide-react"

import { LoadingPlaceholder } from "@/components/system/loading-placeholder"
import { PageHeading } from "@/components/system/page-heading"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function QuestLoadingState({
  mode = "tasks",
}: Readonly<{ mode?: "cleared" | "tasks" }>) {
  return mode === "cleared" ? <ClearedLoadingState /> : <TasksLoadingState />
}

function TasksLoadingState() {
  return (
    <div
      aria-label="Loading Tasks"
      className="quest-studio-page exact-route-loading"
      role="status"
    >
      <span className="sr-only">Loading Tasks</span>
      <div className="quest-studio">
        <header className="quest-overview">
          <div className="quest-overview__heading">
            <div>
              <span>Workspace</span>
              <h1>Tasks</h1>
            </div>
            <p>Create a task or search everything you have.</p>
          </div>
        </header>

        <div aria-hidden="true" className="quest-studio__tabs" role="tablist">
          <button
            aria-selected="true"
            className="quest-studio__tab"
            disabled
            role="tab"
            type="button"
          >
            <Plus /> Create <span>Build a new task</span>
          </button>
          <button
            aria-selected="false"
            className="quest-studio__tab"
            disabled
            role="tab"
            type="button"
          >
            <Search /> Search <span>Find and refine</span>
          </button>
          <button
            aria-selected="false"
            className="quest-studio__tab"
            disabled
            role="tab"
            type="button"
          >
            <Trash2 /> Trash <span>Recently removed</span>
          </button>
        </div>

        <section aria-hidden="true" className="quest-studio__panel">
          <Card className="quest-create-card scroll-mt-20">
            <CardHeader className="quest-create-card__header">
              <span className="quest-create-card__icon">
                <WandSparkles />
              </span>
              <div>
                <CardTitle className="quest-create-card__title">
                  New task
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Turn an intention into something you can finish.
                </p>
              </div>
              <span className="quest-create-card__timezone">
                <Flag /> Local
              </span>
            </CardHeader>
            <CardContent className="quest-create-card__content">
              <div className="grid gap-5">
                <div className="quest-fields">
                  <LoadingField
                    className="quest-fields__title"
                    label="Task title"
                    size="input"
                  />
                  <LoadingField
                    className="quest-fields__description"
                    label="Description"
                    size="textarea"
                  />
                  <div className="quest-fields__planning">
                    <fieldset className="quest-priority">
                      <legend>Priority</legend>
                      <div className="quest-priority__options">
                        {[
                          ["low", "Low"],
                          ["medium", "Medium"],
                          ["high", "High"],
                          ["critical", "Critical"],
                        ].map(([value, label]) => (
                          <label key={value}>
                            <input
                              defaultChecked={value === "medium"}
                              disabled
                              name="loading-priority"
                              type="radio"
                            />
                            <span data-priority={value}>{label}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset className="quest-schedule">
                      <div className="quest-schedule__heading">
                        <div>
                          <legend>
                            <CalendarDays /> Schedule
                          </legend>
                          <p>Set a time window, or leave the task flexible.</p>
                        </div>
                        <span className="quest-schedule__timezone">
                          <Clock3 /> Local
                        </span>
                      </div>
                      <div className="quest-schedule__presets">
                        <button disabled type="button">
                          Today · 2 hours
                        </button>
                        <button disabled type="button">
                          Tomorrow · 9–5
                        </button>
                        <button disabled type="button">
                          <RotateCcw /> Clear
                        </button>
                      </div>
                      <div className="quest-schedule__range">
                        {["Starts", "Due"].map((label) => (
                          <div className="quest-schedule__moment" key={label}>
                            <div className="quest-schedule__moment-title">
                              <span />
                              <strong>{label}</strong>
                              <small>Not set</small>
                            </div>
                            <div className="quest-schedule__controls">
                              <LoadingField label="Date" size="control" />
                              <LoadingField label="Time" size="control" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                  <details className="quest-fields__advanced">
                    <summary tabIndex={-1}>
                      <span>More options</span>
                      <small>Repeat and organise</small>
                    </summary>
                  </details>
                </div>
                <div className="quest-create-card__footer">
                  <span>Ctrl/⌘ + Enter to create</span>
                  <button className="quest-composer__submit" disabled>
                    Create Task
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}

function ClearedLoadingState() {
  return (
    <div
      aria-label="Loading Completed"
      className="grid gap-section exact-route-loading"
      role="status"
    >
      <span className="sr-only">Loading Completed</span>
      <PageHeading
        actions={<LoadingPlaceholder className="exact-loading__badge" />}
        description="Review completed tasks and reopen anything that still needs attention."
        eyebrow="Archive"
        title="Completed"
      />
      <section aria-hidden="true" className="quest-search-tools">
        <div className="quest-search-tools__topline">
          <span>
            <SlidersHorizontal /> Refine your search
          </span>
          <small>Quick filters</small>
        </div>
        <div className="quest-search-tools__query">
          <label>What are you looking for?</label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-system-blue" />
            <LoadingPlaceholder className="exact-loading__search-input" />
          </div>
        </div>
        <div className="quest-search-tools__filters">
          {["Priority", "List", "Label", "Due date", "Sort"].map((label) => (
            <div className="quest-search-tools__field" key={label}>
              <label>{label}</label>
              <LoadingPlaceholder className="exact-loading__select" />
            </div>
          ))}
        </div>
      </section>
      <Card
        aria-hidden="true"
        className="quest-card border-border-soft bg-card/78 shadow-panel"
      >
        <CardHeader className="border-b border-border-soft pb-4">
          <div className="flex flex-col gap-3">
            <CardTitle className="text-lg">
              <LoadingPlaceholder className="exact-loading__line exact-loading__line--title" />
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <LoadingPlaceholder className="exact-loading__badge" />
              <LoadingPlaceholder className="exact-loading__badge" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <LoadingPlaceholder className="exact-loading__line exact-loading__line--body" />
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" /> Cleared
              <LoadingPlaceholder className="exact-loading__inline-value" />
            </span>
          </div>
          <button
            className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-border-soft px-4 font-semibold"
            disabled
          >
            <Check className="size-4" /> Reopen
          </button>
        </CardContent>
      </Card>
    </div>
  )
}

function LoadingField({
  className,
  label,
  size,
}: Readonly<{
  className?: string
  label: string
  size: "control" | "input" | "textarea"
}>) {
  return (
    <div className={className ?? "quest-schedule__control"}>
      <label>{label}</label>
      <LoadingPlaceholder className={`exact-loading__${size}`} />
    </div>
  )
}
