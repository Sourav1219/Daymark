import { Skeleton } from "@/components/ui/skeleton"

export function QuestLoadingState() {
  return (
    <div aria-label="Loading tasks" className="grid gap-section" role="status">
      <span className="sr-only">Loading tasks</span>
      <div className="grid gap-3 border-b border-border-soft pb-section">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-12 w-full max-w-xl" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <div className="grid gap-4">
        {["quest-a", "quest-b"].map((key) => (
          <div
            className="grid gap-4 rounded-panel border border-border-soft bg-card/60 p-panel shadow-panel"
            key={key}
          >
            <Skeleton className="h-6 w-2/5" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-8 w-36" />
          </div>
        ))}
      </div>
    </div>
  )
}
