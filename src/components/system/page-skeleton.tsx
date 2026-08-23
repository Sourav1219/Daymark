import { Skeleton } from "@/components/ui/skeleton"

export function PageSkeleton() {
  return (
    <div aria-label="Loading page" className="grid gap-section" role="status">
      <span className="sr-only">Loading page</span>
      <div className="grid gap-3 border-b border-border-soft pb-section">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-12 w-full max-w-xl" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <div className="grid min-h-80 gap-4 rounded-panel border border-border-soft bg-card/60 p-panel shadow-panel">
        <Skeleton className="size-14 rounded-full" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-lg" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    </div>
  )
}
