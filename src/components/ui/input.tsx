import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-border-soft bg-surface-overlay px-3.5 py-1 text-base transition-[color,border-color,box-shadow] duration-[var(--duration-fast)] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-ink-muted hover:border-border-strong focus-visible:border-system-blue/50 focus-visible:ring-3 focus-visible:ring-system-blue/25 disabled:pointer-events-none disabled:cursor-wait disabled:opacity-70 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
