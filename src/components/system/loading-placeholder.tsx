import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

export function LoadingPlaceholder({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("loading-placeholder", className)}
      {...props}
    />
  )
}
