import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type PageHeadingProps = Readonly<{
  actions?: ReactNode
  as?: "h1" | "h2"
  className?: string
  description?: string
  eyebrow: string
  title: string
}>

export function PageHeading({
  actions,
  as: Component = "h1",
  className,
  description,
  eyebrow,
  title,
}: PageHeadingProps) {
  return (
    <header className={cn("enter-up flex flex-col gap-4", className)}>
      <div className="chip-badge pl-3">
        <span aria-hidden="true" className="diamond" />
        {eyebrow}
      </div>

      <div className="flex items-start justify-between gap-3">
        <Component className="text-3xl font-bold tracking-tight text-balance text-ink">
          {title}
        </Component>
        {actions ? <div className="shrink-0 pt-1">{actions}</div> : null}
      </div>

      {description ? (
        <p className="max-w-2xl font-serif text-lg leading-relaxed text-ink-muted italic text-pretty">
          {description}
        </p>
      ) : null}
    </header>
  )
}
