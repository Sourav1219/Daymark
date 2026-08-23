import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type PageHeadingProps = Readonly<{
  actions?: ReactNode
  className?: string
  description?: string
  eyebrow: string
  title: string
}>

export function PageHeading({
  actions,
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
        <h1 className="text-3xl font-bold tracking-tight text-balance text-ink">
          {title}
        </h1>
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
