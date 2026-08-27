import { Suspense } from "react"

import { PageSkeleton } from "@/components/system/page-skeleton"
import { SystemRouteLoadingState } from "@/components/system/route-loading-screen"

export default function SystemLoading() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SystemRouteLoadingState />
    </Suspense>
  )
}
