import { PageSkeleton } from "@/components/system/page-skeleton"

export default function Loading() {
  return (
    <div className="app-stage">
      <div className="device-frame">
        <main className="device-main">
          <PageSkeleton />
        </main>
      </div>
    </div>
  )
}
