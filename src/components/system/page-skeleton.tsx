import { Skeleton } from "@/components/ui/skeleton"

type PageSkeletonProps = Readonly<{
  description?: string
  eyebrow?: string
  title?: string
  variant?: "cards" | "profile" | "progress" | "settings" | "timer"
}>

export function PageSkeleton({
  description = "Your workspace will be ready in a moment.",
  eyebrow = "Workspace",
  title = "Loading",
  variant = "cards",
}: PageSkeletonProps = {}) {
  return (
    <div
      aria-label={title === "Loading" ? "Loading page" : `Loading ${title}`}
      className="route-loading"
      data-variant={variant}
      role="status"
    >
      <span className="sr-only">Loading {title}</span>
      <header className="route-loading__header">
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <LoadingBody variant={variant} />
    </div>
  )
}

function LoadingBody({
  variant,
}: Readonly<{ variant: NonNullable<PageSkeletonProps["variant"]> }>) {
  if (variant === "timer") {
    return (
      <section aria-hidden="true" className="route-loading__timer-card">
        <span className="route-loading__label">Focus timer</span>
        <strong>00:00:00</strong>
        <div className="route-loading__timer-actions">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      </section>
    )
  }

  if (variant === "profile") {
    return (
      <section aria-hidden="true" className="route-loading__profile-card">
        <Skeleton className="route-loading__avatar" />
        <div>
          <Skeleton className="route-loading__line route-loading__line--title" />
          <Skeleton className="route-loading__line route-loading__line--medium" />
        </div>
        <div className="route-loading__profile-details">
          <Skeleton />
          <Skeleton />
        </div>
      </section>
    )
  }

  return (
    <div aria-hidden="true" className="route-loading__cards">
      {variant === "progress" ? (
        <article className="route-loading__summary-card">
          <span className="route-loading__label">Overview</span>
          <Skeleton className="route-loading__line route-loading__line--title" />
          <Skeleton className="route-loading__meter" />
        </article>
      ) : null}
      {["first", "second", variant === "settings" ? "third" : null]
        .filter(Boolean)
        .map((key) => (
          <article className="route-loading__card" key={key}>
            <Skeleton className="route-loading__card-icon" />
            <div>
              <Skeleton className="route-loading__line route-loading__line--title" />
              <Skeleton className="route-loading__line route-loading__line--body" />
              <Skeleton className="route-loading__line route-loading__line--short" />
            </div>
          </article>
        ))}
    </div>
  )
}
