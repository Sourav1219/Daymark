import { cn } from "@/lib/utils"

export function SystemMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 rotate-45 place-items-center rounded-control border border-system-blue/55 bg-system-blue/5 shadow-glow-blue",
        className,
      )}
    >
      <span className="flex -rotate-45 items-end gap-0.5">
        <span className="h-2.5 w-0.5 rounded-full bg-spectral-cyan" />
        <span className="h-4 w-0.5 rounded-full bg-system-blue" />
        <span className="h-3 w-0.5 rounded-full bg-mana-violet" />
      </span>
    </span>
  )
}
