import { PageSkeleton } from "@/components/system/page-skeleton"

export default function LegalLoading() {
  return (
    <PageSkeleton
      description="Fetching the latest version of this document."
      eyebrow="Traketo"
      title="Loading"
    />
  )
}
