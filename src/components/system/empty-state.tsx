import type { ReactNode } from "react"
import { Orbit } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type EmptyStateProps = Readonly<{
  action?: ReactNode
  className?: string
  description: string
  icon?: ReactNode
  title: string
  variant?: "default" | "trash"
}>

export function EmptyState({
  action,
  className,
  description,
  icon,
  title,
  variant = "default",
}: EmptyStateProps) {
  return (
    <Card
      className={cn(
        "enter-pop border-dashed border-border-strong bg-card/60 shadow-panel",
        variant === "trash" && "empty-state--trash",
        className,
      )}
    >
      <CardContent className="empty-state__content grid min-h-64 place-items-center p-8 text-center">
        <div className="empty-state__body max-w-md">
          <div className="empty-state__visual" aria-hidden="true">
            <span className="empty-state__icon mx-auto grid size-16 place-items-center rounded-2xl border border-system-blue/40 bg-gradient-to-br from-system-blue/20 to-mana-violet/10 text-spectral-cyan shadow-glow-blue">
              {icon ?? <Orbit className="size-7" />}
            </span>
          </div>
          {variant === "trash" ? (
            <span className="empty-state__eyebrow">All clear</span>
          ) : null}
          <h2 className="empty-state__title mt-5 text-xl font-bold tracking-tight">
            {title}
          </h2>
          <p className="empty-state__description mt-2 font-serif text-sm leading-6 text-ink-muted italic text-pretty">
            {description}
          </p>
          {action ? <div className="mt-6">{action}</div> : null}
          {variant === "trash" ? (
            <p className="empty-state__status">
              <span aria-hidden="true" /> Nothing waiting in recovery
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
